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
 * reassigned on every rebuild (so identity is derived — see `stableKey`), and its
 * taxonomies are often wrong (so food is proven on content — see
 * `isProvenFoodSite`).
 */
import { fromDayRanges, type DayRange } from '../lib/openingHours.ts';
import { stableKey } from '../lib/stableKey.ts';
import { titleCaseName } from '../lib/displayName.ts';
import { sleep } from '../lib/http.ts';
import { formatAddress, isSaneCoord, parseStateFilter, trimOrNull } from '../lib/normalize.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'feed-america';
const ATTRIBUTION_URL = 'https://feedam.org';

// Food-distribution taxonomies only. Child-nutrition programs (`school-meals`,
// `summer-meals`) are excluded: they are served at schools, not to adult veterans.
const FOOD_TAXONOMIES = new Set([
  'food-pantries',
  'food-banks',
  'soup-kitchens',
  'mobile-food-pantries',
  'community-fridges',
  'emergency-food',
]);

// The feed's food taxonomies are attached to senior apartments, home health,
// hospice, clinics and more, so food must be PROVEN: a row counts only if its own
// text says food and it carries no clinical/housing class marker (NON_FOOD_CLASS).
// The survivors (~61k) match Feeding America's published network size.
const FOOD_EVIDENCE =
  // Plurals matter: `\bmeal\b` does NOT match "meals", which silently rejected
  // "Hot meals served daily to anyone in need" — a soup kitchen.
  /\b(foods?|meals?|pantr(?:y|ies)|grocer\w*|produce|hunger|harvest|commodit\w*|soup kitchen|congregate dining|WIC|SNAP|nutrition assistance|feeding)\b/i;

/**
 * Class markers that disqualify a row no matter what else it says. Dialysis
 * centres are here because their service text mentions renal *diet* and therefore
 * trips FOOD_EVIDENCE — proof that positive evidence alone is not enough.
 */
const NON_FOOD_CLASS =
  /\b(home health|hospice|rural health clinic|federally.certified rural|HUD Section|Rent typically|apply via property management|LIHTC|Medicare.certified|intermediate care facility|Ryan White|Indian Health Service|Department of Veterans Affairs facility|dialysis|end.stage renal|skilled nursing|assisted living|opioid treatment|methadone|buprenorphine|naltrexone|medication.assisted|substance use disorder|detox|psychiatric|mental health treatment facility)\b/i;

/**
 * Is this actually somewhere a veteran can get food? Checked against the service's
 * `eligibility_description` plus the location name — the only two pieces of text
 * the feed gives us that describe what the place does.
 */
export const isProvenFoodSite = (text: string): boolean =>
  FOOD_EVIDENCE.test(text) && !NON_FOOD_CLASS.test(text);

// Pantries hosted inside a school or childcare centre ("Kids Café Parkwood
// Elementary") usually serve enrolled families only. Deliberately narrow:
// "University Baptist Church" and "College Hill Food Pantry" must survive.
const SCHOOL_VENUE =
  /(\belementary\b|\bmiddle school\b|\bhigh school\b|\bjunior high\b|\bpreschool\b|\bpre-k\b|\bhead start\b|\bkids caf|\bdaycare\b|\bday care\b|\bchild care\b|\bchildcare\b|\bacademy\b|\bschool district\b|\b[A-Z]{2,4} ISD\b|\bisd\b)/i;
// SNAP-accepting retailers ("Subway # 42247", "WALMART #5663", "… dba KFC") are
// not food assistance. A national chain brand OR a franchise marker
// (COMMERCIAL_MARKER) is decisive. Generic words like `kitchen`/`bakery` are not
// matched: "St Mary's Kitchen" is a real pantry.
// Use JS `\b` here — Postgres's `\m`/`\M` is an identity escape in JS and matches nothing.
const COMMERCIAL_CHAIN =
  // Possessive brands require the apostrophe-s ("McDonald Mission Center" is a real
  // mission), and `target` is excluded ("On Target Ministries").
  /\b(kfc|mcdonald's|subway|starbucks|domino's|pizza hut|taco bell|wendy's|burger king|chipotle|dunkin|panera|popeyes|chick[- ]?fil[- ]?a|little caesars|papa john's|jack in the box|sonic drive|arby's|hardee's|whataburger|culver's|jimmy john's|firehouse subs|wingstop|panda express|olive garden|applebee's|denny's|ihop|waffle house|7[- ]?eleven|walmart|kroger|safeway|costco|dollar general|dollar tree|family dollar|cvs|walgreens|rite aid|circle k|speedway|wawa|sheetz|aldi|publix|winn[- ]?dixie|trader joe's|whole foods)\b/i;

/**
 * Franchise markers. `dba` is a franchisee trading name, which no pantry has.
 * Store numbers appear three ways in this feed — `Subway # 42247`, `Subway 20053`,
 * and `Kfc K312047` — so a bare run of four or more digits counts, with or without
 * the hash. Real pantries do not carry four-digit numbers in their names.
 */
const COMMERCIAL_MARKER = /\bdba\b|#\s*\d{2,}|\b[A-Z]?\d{4,}\b/i;

export const isCommercialVenue = (name: string): boolean =>
  COMMERCIAL_CHAIN.test(name) || COMMERCIAL_MARKER.test(name);

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
        console.warn(
          `[ingest] feed-america: skipping page after retries (${String(err).slice(0, 120)})`,
        );
        return null;
      }
      await sleep(1000 * 2 ** attempt);
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
    await sleep(WAVE_DELAY_MS);
    if (start % (CONCURRENCY * 10) < CONCURRENCY) {
      console.log(`[ingest] feed-america ${resource}: ${rows.length} rows…`);
    }
  }
  if (skipped > 0) {
    console.warn(`[ingest] feed-america ${resource}: skipped ${skipped}/${totalPages} pages`);
    if (skipped / totalPages > 0.1)
      throw new Error(`Feed America: ${resource} lost ${skipped} pages`);
  }
  return rows;
}

export const createFeedAmericaFoodSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      // Optional `--state "TX,FL"` for spot-checks; national by default.
      const stateFilter = parseStateFilter(query.state);

      console.log(
        '[ingest] feed-america: downloading locations/addresses/phones/services/attributes/schedules…',
      );
      const [locations, addresses, phones, services, attributes, serviceAtLocation, schedules] =
        await Promise.all([
          fetchTable(config.baseUrl, 'locations'),
          fetchTable(config.baseUrl, 'addresses'),
          fetchTable(config.baseUrl, 'phones'),
          fetchTable(config.baseUrl, 'services'),
          fetchTable(config.baseUrl, 'attributes'),
          fetchTable(config.baseUrl, 'service_at_location'),
          fetchTable(config.baseUrl, 'schedules'),
        ]);

      const addressByLocation = new Map(addresses.map((a) => [str(a, 'location_id'), a]));
      const serviceById = new Map(services.map((s) => [str(s, 'id'), s]));
      // Join through HSDS's explicit `service_at_location` link, never by id pattern.
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
      // HSDS `schedules`: one row per open day per service, real clock times.
      // Grouped by location; fromDayRanges keeps the widest span per day.
      const scheduleByLocation = new Map<string, DayRange[]>();
      for (const row of schedules) {
        const locId = str(row, 'location_id');
        if (!locId) continue;
        // Skip delivery / appointment-only windows; only promise explicit open hours.
        const attending = str(row, 'attending_type').toLowerCase();
        if (attending && attending !== 'open') continue;
        const day = str(row, 'byday');
        const opens = str(row, 'opens_at');
        const closes = str(row, 'closes_at');
        if (!day || !opens || !closes) continue;
        const bucket = scheduleByLocation.get(locId);
        const entry = { day, opens, closes };
        if (bucket) bucket.push(entry);
        else scheduleByLocation.set(locId, [entry]);
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
        const state =
          (addr ? trimOrNull(str(addr, 'state_province')) : null)?.toUpperCase() ?? null;
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
        const address = formatAddress(
          street,
          addr ? trimOrNull(str(addr, 'city')) : null,
          state,
          addr ? trimOrNull(str(addr, 'postal_code')) : null,
        );
        if (!located && !address) continue; // neither pinnable nor visitable

        const serviceId = serviceIdByLocation.get(locId);
        if (!serviceId || !foodServices.has(serviceId)) continue; // clinic / SNAP office / WIC
        const service = serviceById.get(serviceId);
        const eligibility = service ? trimOrNull(str(service, 'eligibility_description')) : null;
        // Food must be proven, not assumed — see isProvenFoodSite.
        if (!isProvenFoodSite(`${name} ${eligibility ?? ''}`)) continue;
        if (SCHOOL_VENUE.test(name)) continue;
        if (isCommercialVenue(name)) continue;

        // Keyed on identity, not on the feed's volatile row ids — see stableKey().
        const externalId = stableKey(name, address, state);
        const id = `feedam:${externalId}`;
        if (seen.has(id)) continue;
        const website = service ? trimOrNull(str(service, 'url')) : null;

        seen.add(id);
        results.push({
          id,
          // Upstream stores names in upper case; see lib/displayName.ts.
          name: titleCaseName(name),
          category: 'food',
          description:
            (service ? trimOrNull(str(service, 'description')) : null) ??
            'Food pantry / food-assistance site — free food for people in need.',
          address,
          latitude: located ? lat : null,
          longitude: located ? lng : null,
          phone: phoneByLocation.get(locId) ?? null,
          website,
          hours: fromDayRanges(scheduleByLocation.get(locId) ?? []),
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
