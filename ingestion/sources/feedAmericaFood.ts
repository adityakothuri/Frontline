/**
 * Feed America food-assistance adapter (feedam.org HSDS 3.0 feed).
 *
 * There is no official federal dataset of food pantry locations (USDA publishes
 * none; Feeding America has no public API), so the food category uses the open
 * HSDS 3.0 feed published by Feed America (feedam.org, EIN 92-1761881) — ~310k
 * US food-assistance sites aggregated from 211/Plentiful/AmpleHarvest, daily
 * refresh. License: CC BY-SA 4.0; required attribution "Data from Feed America,
 * feedam.org, EIN 92-1761881" (carried in `source_url` + ingestion/README.md).
 *
 * This is a third-party AGGREGATOR, not an official source, so rows ship as
 * `source_type: 'directory'` / `verification_status: 'needs_review'` — the app
 * renders the amber "call ahead" treatment, which is exactly right for pantry
 * hours. `veteran_relevance: 'general'` (open to everyone, hybrid rule).
 *
 * ROLLOUT IS PILOT-GATED: run with `--state XX` and spot-check before any
 * national ingest (national also needs a DB-size check — 310k rows would be
 * ~20x the rest of the dataset combined).
 *
 * Tables (locations/addresses/phones/services, aligned by `loc-N`/`svc-N` ids)
 * are pulled via the JSON endpoints at per_page=1000 — page 1 reports
 * `total_pages`, so the rest fetch in parallel chunks (~311 pages per table
 * nationally). Joins are by `location_id`/`service_id`.
 */
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'feed-america';
const ATTRIBUTION_URL = 'https://feedam.org';

// The feed also carries FQHC health centers, SNAP-enrollment offices, and WIC
// offices — real services, but not "a place to get food" (spot-check found
// dental clinics). Only actual food-distribution taxonomies are ingested.
const FOOD_TAXONOMIES = new Set([
  'food-pantries',
  'food-banks',
  'soup-kitchens',
  'mobile-food-pantries',
  'community-fridges',
  'emergency-food',
  'school-meals',
  'summer-meals',
]);
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const PER_PAGE = 1000;
// The feed 500s under parallel load — stay gentle and pace between waves.
const CONCURRENCY = 2;
const WAVE_DELAY_MS = 300;

/** Rows come back as loosely-typed JSON objects; we read fields defensively. */
type FeedRow = Record<string, unknown>;

interface FeedPage {
  total_pages?: number;
  contents?: FeedRow[];
}

const str = (row: FeedRow, key: string): string =>
  typeof row[key] === 'string' ? (row[key] as string) : row[key] == null ? '' : String(row[key]);

/** One page, retried; null when a page 5xxs persistently (server-side bad offset). */
async function fetchPage(url: string): Promise<FeedPage | null> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Feed America: HTTP ${response.status} for ${url}`);
      return (await response.json()) as FeedPage;
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        console.warn(`[ingest] feed-america: skipping page after retries (${String(err).slice(0, 120)})`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Fetch a whole table: page 1 reports total_pages, the rest go in parallel.
 * Isolated bad pages are skipped with a warning (a lost page = those rows just
 * don't update this run); more than 10% lost fails the run — that's an outage.
 */
async function fetchTable(baseUrl: string, resource: string): Promise<FeedRow[]> {
  const pageUrl = (page: number): string =>
    `${baseUrl.replace(/\/$/, '')}/${resource}?per_page=${PER_PAGE}&page=${page}`;
  const first = await fetchPage(pageUrl(1));
  if (!first) throw new Error(`Feed America: ${resource} page 1 unavailable`);
  const totalPages = first.total_pages ?? 1;
  const rows: FeedRow[] = [...(first.contents ?? [])];
  let skipped = 0;
  for (let start = 2; start <= totalPages; start += CONCURRENCY) {
    const pages: number[] = [];
    for (let p = start; p < start + CONCURRENCY && p <= totalPages; p++) pages.push(p);
    const bodies = await Promise.all(pages.map((p) => fetchPage(pageUrl(p))));
    for (const body of bodies) {
      if (body) rows.push(...(body.contents ?? []));
      else skipped++;
    }
    await new Promise((r) => setTimeout(r, WAVE_DELAY_MS));
    if (start % (CONCURRENCY * 10) < CONCURRENCY) {
      console.log(`[ingest] feed-america ${resource}: ${rows.length} rows…`);
    }
  }
  if (skipped > 0) {
    console.warn(`[ingest] feed-america ${resource}: skipped ${skipped}/${totalPages} pages`);
    if (skipped / totalPages > 0.1) throw new Error(`Feed America: ${resource} lost ${skipped} pages`);
  }
  return rows;
}

const trimOrNull = (s: string | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

function isSaneCoord(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return lat !== 0 || lng !== 0;
}

export const createFeedAmericaFoodSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const stateFilter = query.state?.toUpperCase() ?? null;
      if (!stateFilter) {
        // Hard pilot gate, not a comment: national is ~310k rows and needs an
        // explicit license + DB-size decision. Remove this only with sign-off.
        throw new Error(
          'feed-america is pilot-gated: pass --state XX. National ingest requires explicit approval (CC BY-SA + DB size).',
        );
      }

      console.log('[ingest] feed-america: downloading locations/addresses/phones/services/attributes…');
      const [locations, addresses, phones, services, attributes] = await Promise.all([
        fetchTable(config.baseUrl, 'locations'),
        fetchTable(config.baseUrl, 'addresses'),
        fetchTable(config.baseUrl, 'phones'),
        fetchTable(config.baseUrl, 'services'),
        fetchTable(config.baseUrl, 'attributes'),
      ]);

      const addressByLocation = new Map(addresses.map((a) => [str(a, 'location_id'), a]));
      const serviceById = new Map(services.map((s) => [str(s, 'id'), s]));
      // service id → is it an actual food-distribution service?
      const foodServices = new Set<string>();
      for (const t of attributes) {
        if (t && FOOD_TAXONOMIES.has(str(t, 'taxonomy_term_id'))) {
          foodServices.add(str(t, 'link_id'));
        }
      }
      const phoneByLocation = new Map<string, string>();
      for (const p of phones) {
        const locId = str(p, 'location_id');
        const number = str(p, 'number').trim();
        if (str(p, 'type') === 'voice' && locId && number && !phoneByLocation.has(locId)) {
          phoneByLocation.set(locId, number);
        }
      }

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      for (const loc of locations) {
        if (str(loc, 'location_type') !== 'physical') continue;
        const locId = str(loc, 'id');
        const addr = addressByLocation.get(locId);
        const state = (addr ? trimOrNull(str(addr, 'state_province')) : null)?.toUpperCase() ?? null;
        if (stateFilter && state !== stateFilter) continue;

        const name = trimOrNull(str(loc, 'name'));
        if (!name) continue;
        const externalId = trimOrNull(str(loc, 'external_identifier')) ?? locId;
        const id = `feedam:${externalId}`;
        if (seen.has(id)) continue;

        const lat = Number(str(loc, 'latitude'));
        const lng = Number(str(loc, 'longitude'));
        const located = isSaneCoord(lat, lng);
        const street = [
          addr ? trimOrNull(str(addr, 'address_1')) : null,
          addr ? trimOrNull(str(addr, 'address_2')) : null,
        ]
          .filter(Boolean)
          .join(' ');
        const region = [state, addr ? trimOrNull(str(addr, 'postal_code')) : null]
          .filter(Boolean)
          .join(' ');
        const address =
          [street, [addr ? trimOrNull(str(addr, 'city')) : null, region].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join(', ') || null;
        if (!located && !address) continue; // neither pinnable nor visitable

        // `svc-N` aligns with `loc-N` in this feed; fall back gracefully if not.
        const serviceId = locId.replace(/^loc-/, 'svc-');
        if (!foodServices.has(serviceId)) continue; // clinic / SNAP office / WIC — not a food site
        const service = serviceById.get(serviceId);
        const website = service ? trimOrNull(str(service, 'url')) : null;

        seen.add(id);
        results.push({
          id,
          name,
          category: 'food',
          description:
            (service ? trimOrNull(str(service, 'description')) : null) ??
            'Food pantry / food-assistance site — free food for people in need.',
          address,
          latitude: located ? lat : null,
          longitude: located ? lng : null,
          phone: phoneByLocation.get(locId) ?? null,
          website,
          hours: null, // schedules exist upstream but are irregular — call ahead
          eligibility:
            (service ? trimOrNull(str(service, 'eligibility_description')) : null) ??
            'Open to everyone, including veterans and families. Call ahead to confirm hours and what to bring.',
          documents_needed: [],
          source_url: ATTRIBUTION_URL,
          source_type: 'directory',
          veteran_relevance: 'general',
          verification_status: 'needs_review', // aggregator data — call ahead
          last_checked: today,
          last_updated: today,
          tags: ['food-assistance'],
          created_at: today,
          updated_at: today,
          external_id: externalId,
          source_provider: PROVIDER,
          ingested_at: today,
          // Full raw payloads would bloat resource_sources at this scale; keep the join keys.
          raw: { location_id: locId, external_identifier: externalId, state },
        });
      }
      return results;
    },
  };
};
