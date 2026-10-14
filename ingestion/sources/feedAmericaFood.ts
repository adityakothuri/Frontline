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
 * proven on content, not assumed — see `isProvenFoodSite`).
 */
import { fromDayRanges, type DayRange } from '../lib/openingHours.ts';
import { stableKey } from '../lib/stableKey.ts';
import { titleCaseName } from '../lib/displayName.ts';
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

// THE TAXONOMY CANNOT BE TRUSTED, SO FOOD MUST BE PROVEN, NOT ASSUMED.
//
// This aggregator is not a food feed. It is a general health-and-human-services
// directory, and its food taxonomies are attached to things that are not food. A
// 2026-07-28 audit of the live `food` category found, alongside real pantries:
//
//   10,928  HUD Section 202 subsidised senior APARTMENT buildings
//   10,882  Medicare-certified home health agencies
//    5,997  HOSPICE providers
//    5,421  rural health clinics
//    2,346  community clinics
//    1,493  VA facilities (Vet Centers, CBOCs)
//      892  intermediate care facilities
//           dialysis centres, Ryan White HIV providers, Indian Health Service sites
//
// A veteran searching for food was being shown end-of-life care. That is the
// fourth distinct class of non-food to reach this category — after school
// cafeterias, mis-tagged behavioural health, and SNAP retailers — and the pattern
// is now unmistakable: excluding each bad class as it is discovered will never
// finish, because the feed's taxonomy simply does not mean what it says.
//
// So the logic is INVERTED. A row is not food unless the feed's own service text
// SAYS it is food, and a row that also carries a clinical or housing class marker
// is rejected even if it does. Everything unproven is dropped.
//
// This cuts the category roughly in half — and the survivors, ~61,000, match
// Feeding America's own published network size of about 60,000 pantries and meal
// programmes. The previous 127,671 was never a food count.
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
// The aggregator also mixes in SNAP-accepting RETAILERS, and they are unmistakable
// once you look: "Subway # 42247", "WALMART #5663", "Pizza Hut #26198",
// "Great Am Chicken Corp dba KFC E791005". 3,289 of them were sitting in the food
// category on 2026-07-28.
//
// A veteran who taps Food and is shown KFC does not conclude "this one row is
// wrong", they conclude the app is junk — and they are right to. Accepting SNAP is
// not food assistance either: the category promises somewhere to GET food when you
// have none, and a veteran already knows where Walmart is.
//
// Same reasoning as SCHOOL_VENUE above, applied to commercial venues. Matched on
// three signals, any one of which is decisive:
//   1. a national chain brand,
//   2. `dba` — a franchisee trading name, which no pantry has,
//   3. a bare franchise store number (`Subway # 42247`, `WALMART #5663`).
//
// Deliberately conservative on generic food words: a real pantry can legitimately
// be "St Mary's Kitchen" or "The Bread of Life Bakery", so `kitchen`, `bakery` and
// `deli` are NOT matched on their own.
// NOTE ON THE REGEX FLAVOUR — this bit me. Postgres word boundaries are `\m` and
// `\M`; JavaScript's is `\b`. The first version of this filter used the Postgres
// form in a JS regex, where `\m` is just an identity escape for the letter "m", so
// the pattern silently matched NOTHING and 507 retailers walked straight back in on
// the next re-ingest. The SQL purge in migration 0032 worked because Postgres
// understood it. Two dialects, same file, different escapes.
const COMMERCIAL_CHAIN =
  // Possessive brands REQUIRE the apostrophe-s. Chains write themselves that way
  // ("McDonald's 34450"), while charities named after a person do not — dropping
  // that requirement made this filter reject "McDonald Mission Center", a real
  // mission. Same reasoning excludes `target` altogether: "Target Hope" and "On
  // Target Ministries" are genuine nonprofits, and Walmart/Costco/Kroger already
  // cover big-box retail.
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
    if (skipped / totalPages > 0.1)
      throw new Error(`Feed America: ${resource} lost ${skipped} pages`);
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
 * Why this pantry's id is a hash rather than the feed's own key: the feed's
 * `loc-N` / `external_identifier` values are NOT durable — they are reassigned
 * whenever the aggregator rebuilds. Measured 2026-07-27, 82,193 of 116,500
 * ingested rows (71%) referenced ids past the feed's then-current maximum, and
 * 4,099 rows were exact name+address duplicates left by earlier runs. Keying on
 * the feed id orphans every previous row on each refresh instead of updating it.
 *
 * The hash itself lives in ../lib/stableKey.ts, shared with the SAMHSA adapter,
 * which has the same problem for the same reason.
 */

export const createFeedAmericaFoodSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
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
      // HSDS `schedules` is one row per open day per service, with real clock
      // times — the only source of opening hours for the food category, which is
      // the app's largest and the one where "is it open right now" matters most.
      // Rows are keyed by location; a location legitimately appears several times
      // (once per day, sometimes once per service), so they are grouped and the
      // widest span per day wins.
      const scheduleByLocation = new Map<string, DayRange[]>();
      for (const row of schedules) {
        const locId = str(row, 'location_id');
        if (!locId) continue;
        // `attending_type` distinguishes open hours from other kinds of window
        // (delivery, appointment-only). Anything that isn't explicitly open is
        // not something we can promise a veteran.
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
