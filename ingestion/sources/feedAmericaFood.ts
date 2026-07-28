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
 * Runs nationally by default; `--state XX[,YY]` narrows it for spot-checks.
 *
 * Tables are pulled via the JSON endpoints at per_page=1000 — page 1 reports
 * `total_pages`, so the rest fetch in parallel chunks (~311 pages per table
 * nationally). Locations join to services through `service_at_location`, and
 * services carry their food taxonomy in `attributes`.
 *
 * Two properties of this feed drive the defensive code below: its row ids are
 * reassigned on every rebuild (so identity is derived, not read — see
 * `stableKey`), and its taxonomies are not always right (so clinical rows are
 * excluded on content — see `CLINICAL_TEXT`).
 */
import { createHash } from 'node:crypto';
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
//
// `school-meals` and `summer-meals` were removed 2026-07-27: they are child
// nutrition programs (NSLP / USDA SFSP) served at schools, and they accounted
// for 51,839 of 116,500 ingested rows — 44% of the food category was named
// things like "Richmond Hill Middle School". Frontline's users are older
// veterans, who cannot eat at an elementary school.
const FOOD_TAXONOMIES = new Set([
  'food-pantries',
  'food-banks',
  'soup-kitchens',
  'mobile-food-pantries',
  'community-fridges',
  'emergency-food',
]);

// Feed America aggregates from 211/Plentiful/AmpleHarvest and mis-tags some
// upstream sets: 5,215 ingested rows were SAMHSA behavioural-health facilities
// (opioid treatment programs, psychiatric clinics) carrying a food taxonomy.
// The taxonomy can't be trusted alone, so clinical service text is excluded on
// content. Checked against `eligibility_description` + service name.
const CLINICAL_TEXT =
  /\b(opioid treatment|methadone|buprenorphine|naltrexone|medication-assisted|substance use disorder|detox|psychiatric|mental health treatment facility)\b/i;

// Dropping the child-nutrition taxonomies removed the school-meal *programs*,
// but ~3,700 sites tagged as ordinary pantries are still hosted INSIDE a school
// or childcare centre — "Kids Café Parkwood Elementary", "H.T. Jaramillo
// Elementary Head Start". Whatever the taxonomy says, the venue is a school:
// many serve enrolled families only, and a veteran in his seventies is not going
// to walk into an elementary school for groceries. Same reasoning as the
// taxonomy cut, applied to the venue.
//
// Deliberately narrow. It matches school/childcare venue words, NOT every
// building that happens to sit on a campus — "University Baptist Church" and
// "College Hill Food Pantry" are community pantries and must survive, so
// `college`/`university` are matched only as a standalone venue name.
const SCHOOL_VENUE =
  /(\belementary\b|\bmiddle school\b|\bhigh school\b|\bjunior high\b|\bpreschool\b|\bpre-k\b|\bhead start\b|\bkids caf|\bdaycare\b|\bday care\b|\bchild care\b|\bchildcare\b|\bacademy\b|\bschool district\b|\b[A-Z]{2,4} ISD\b|\bisd\b)/i;
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

/**
 * Stable identity for a pantry.
 *
 * The feed's own `loc-N` / `external_identifier` values are NOT durable — they
 * are reassigned whenever the aggregator rebuilds. Measured 2026-07-27: 82,193
 * of 116,500 ingested rows (71%) referenced ids past the feed's then-current
 * maximum, and 4,099 rows were exact name+address duplicates left behind by
 * earlier runs. Keying on the feed id therefore orphans every previous row on
 * each refresh instead of updating it.
 *
 * A pantry is identified by where it is and what it's called, so that's the
 * key: normalized name + street address, hashed to keep ids short.
 */
function stableKey(name: string, address: string | null, state: string): string {
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  // `address` already ends with the state today; it stays in the basis so the
  // key doesn't silently start colliding if that formatting ever changes.
  const basis = `${norm(name)}|${norm(address ?? '')}|${state}`;
  // A collision here silently DROPS a real pantry (the `seen` guard skips it),
  // so the hash has to be wide. A 32-bit hash would be far too narrow: across
  // ~310k national rows the birthday bound predicts ~10 collisions, i.e. ~10
  // food banks quietly missing. 16 base64url chars is 96 bits — negligible.
  return createHash('sha1').update(basis).digest('base64url').slice(0, 16);
}

export const createFeedAmericaFoodSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      // Optional comma-separated states, e.g. --state "TX,FL". Omit for national.
      //
      // The old hard state gate (decision 2026-07-24) capped ingest at 8 states
      // to bound DB size. Dropping child-nutrition taxonomies removes ~44% of
      // the rows, which buys back the headroom — and the gate was actively
      // harmful: it left 42 states, including all of New York, with zero food
      // resources, so those veterans only ever saw a national hunger hotline.
      const stateFilter = query.state
        ? new Set(
            query.state
              .toUpperCase()
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        : null;

      console.log('[ingest] feed-america: downloading locations/addresses/phones/services/attributes…');
      const [locations, addresses, phones, services, attributes, serviceAtLocation] =
        await Promise.all([
          fetchTable(config.baseUrl, 'locations'),
          fetchTable(config.baseUrl, 'addresses'),
          fetchTable(config.baseUrl, 'phones'),
          fetchTable(config.baseUrl, 'services'),
          fetchTable(config.baseUrl, 'attributes'),
          fetchTable(config.baseUrl, 'service_at_location'),
        ]);

      const addressByLocation = new Map(addresses.map((a) => [str(a, 'location_id'), a]));
      const serviceById = new Map(services.map((s) => [str(s, 'id'), s]));
      // HSDS models the location↔service link explicitly. The previous code
      // guessed it by rewriting `loc-N` to `svc-N`; that happens to hold today,
      // but it is an undocumented coincidence of the aggregator's id assignment
      // and silently mispairs records the moment it stops holding.
      const serviceIdByLocation = new Map<string, string>();
      for (const link of serviceAtLocation) {
        const locId = str(link, 'location_id');
        const svcId = str(link, 'service_id');
        if (locId && svcId && !serviceIdByLocation.has(locId)) {
          serviceIdByLocation.set(locId, svcId);
        }
      }
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
        if (!state) continue;
        if (stateFilter && !stateFilter.has(state)) continue;

        const name = trimOrNull(str(loc, 'name'));
        if (!name) continue;

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

        const serviceId = serviceIdByLocation.get(locId);
        if (!serviceId || !foodServices.has(serviceId)) continue; // clinic / SNAP office / WIC
        const service = serviceById.get(serviceId);
        const eligibility = service ? trimOrNull(str(service, 'eligibility_description')) : null;
        // Upstream mis-tagging: behavioural-health facilities carrying a food
        // taxonomy. Sending a veteran to a methadone clinic for groceries is
        // worse than showing nothing, so drop rather than re-file — the
        // healthcare category is served by sources we trust.
        if (CLINICAL_TEXT.test(`${name} ${eligibility ?? ''}`)) continue;
        if (SCHOOL_VENUE.test(name)) continue;

        // Keyed on identity, not on the feed's volatile row ids — see stableKey().
        const externalId = stableKey(name, address, state);
        const id = `feedam:${externalId}`;
        if (seen.has(id)) continue;
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
            eligibility ??
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
