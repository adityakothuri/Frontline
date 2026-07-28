/**
 * Frontline resource ingestion runner.
 *
 * Standalone backend tooling (NOT the app bundle). Fetches a source, normalizes
 * to the `Resource` shape, validates, and upserts into the live `resources`
 * table with provenance. Run with Node's TS type-stripping (Node >= 22):
 *
 *   # 1. dry run against the VA sandbox — verifies the mapping, writes nothing
 *   VA_API_KEY=... node --experimental-strip-types ingestion/run.ts \
 *     --source va-facilities --state CA --dry-run
 *
 *   # 2. live pilot load (needs SUPABASE_URL + SERVICE_ROLE key in .env.seed)
 *   node --experimental-strip-types ingestion/run.ts \
 *     --source va-facilities --lat 34.05 --long -118.24 --radius 25
 *
 * Env (shell or the git-ignored .env.seed): VA_API_KEY, optional
 * VA_FACILITIES_BASE_URL (defaults to sandbox), and for a live write
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. See ingestion/README.md.
 */
import { resolve } from 'node:path';
import { loadEnvFile } from './lib/env.ts';
import { createVaFacilitiesSource } from './sources/vaFacilities.ts';
import { createVaGiBillSchoolsSource } from './sources/vaGiBillSchools.ts';
import { createCuratedNationalSource } from './sources/curatedNational.ts';
import { createHudCounselingSource } from './sources/hudCounseling.ts';
import { createSsvfProvidersSource } from './sources/ssvfProviders.ts';
import { createFeedAmericaFoodSource } from './sources/feedAmericaFood.ts';
import { createAmericanJobCentersSource } from './sources/americanJobCenters.ts';
import { createFisherHousesSource } from './sources/fisherHouses.ts';
import { createHrsaHealthCentersSource } from './sources/hrsaHealthCenters.ts';
import { createHudPublicHousingAuthoritiesSource } from './sources/hudPublicHousingAuthorities.ts';
import { createNacvsoOfficersSource } from './sources/nacvsoOfficers.ts';
import { createCatholicCharitiesSource } from './sources/catholicCharities.ts';
import { createNtdTransitAgenciesSource } from './sources/ntdTransitAgencies.ts';
import { createOsmCharityShopsSource } from './sources/osmCharityShops.ts';
import { createVaTransportationSource } from './sources/vaTransportation.ts';
import { createLscLegalAidSource } from './sources/lscLegalAid.ts';
import { createSamhsaVeteranBehavioralHealthSource } from './sources/samhsaVeteranBehavioralHealth.ts';
import { createStateVeteransHomesSource } from './sources/stateVeteransHomes.ts';
import { createUsaspendingVaGranteesSource } from './sources/usaspendingVaGrantees.ts';
import { createVsoOrganizationsSource } from './sources/vsoOrganizations.ts';
import { geocodeResources } from './censusGeocode.ts';
import { upsertResources, type AdminConfig } from './upsert.ts';
import type { IngestionQuery, NormalizedResource, SourceConfig, SourceFactory } from './types.ts';

const root = resolve(import.meta.dirname, '..');
// VA Facilities is a PUBLIC dataset, so the sandbox host mirrors real production
// facility data — it is NOT a truncated demo. Verified 2026-07-24: sandbox returns
// the full national set (health 1,399, benefits 443, vet_center 417, cemetery 318),
// matching the live table. With the service cross-listing added 2026-07-27 this
// yields ~3,970 rows, every one of them with a phone number.
// The free developer.va.gov key is sandbox-scoped (production 401s), so
// sandbox is the correct, complete source here — do not "upgrade" the default to
// api.va.gov without first provisioning a production key, or ingestion will break.
const VA_SANDBOX_BASE = 'https://sandbox-api.va.gov/services/va_facilities/v1';
const VA_GIBILL_BASE = 'https://api.va.gov/v0/gi/institutions/search';
const HUD_HCS_BASE = 'https://data.hud.gov/Housing_Counselor';

/** A registered source: how to build it and how to read its secrets from env. */
interface SourceDef {
  factory: SourceFactory;
  /** Reads env → connection config, or throws a friendly error if a key is missing. */
  resolveConfig: () => SourceConfig;
}

const SOURCES: Record<string, SourceDef> = {
  'va-facilities': {
    factory: createVaFacilitiesSource,
    resolveConfig: () => ({
      apiKey: requireEnv(process.env.VA_API_KEY, 'VA_API_KEY', 'a free key from developer.va.gov'),
      baseUrl: process.env.VA_FACILITIES_BASE_URL ?? VA_SANDBOX_BASE,
      throttleMs: numberArg(process.env.VA_THROTTLE_MS),
    }),
  },
  'gi-bill': {
    factory: createVaGiBillSchoolsSource,
    // VA GI Bill Comparison Tool institutions API — keyless. `apiKey` here is the
    // optional free api.data.gov key used ONLY for the College Scorecard
    // enrichment pass (website + coordinates); without it the adapter still runs
    // and still gets each school's VA certifying-official phone, it just skips
    // websites. Get one at https://api.data.gov/signup/.
    resolveConfig: () => ({
      apiKey: process.env.DATA_GOV_API_KEY ?? '',
      baseUrl: process.env.VA_GIBILL_BASE_URL ?? VA_GIBILL_BASE,
    }),
  },
  'hud-housing': {
    factory: createHudCounselingSource,
    // HUD's housing-counselor locator is public and keyless. The ONE kept
    // general source: veterans navigating HUD-VASH use HUD-approved counselors,
    // and veteran SSVF providers still rank above it. General (hybrid rule).
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.HUD_HCS_BASE_URL ?? HUD_HCS_BASE,
    }),
  },
  'vso-organizations': {
    factory: createVsoOrganizationsSource,
    // VA OGC's accredited-ORGANIZATION export, rolled up to one office per
    // organization per town. Replaces `vso-representatives`, which listed 7,759
    // individual people with no address. Fetched directly over HTTP, so unlike
    // the rep list there is no manual download step. Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.VA_OGC_ORGS_URL ??
        'https://www.va.gov/ogc/apps/accreditation/orgsexcellist.asp',
    }),
  },
  'state-veterans-homes': {
    factory: createStateVeteransHomesSource,
    // VA-certified long-term care run by the states — the most on-mission
    // resource there is for an aging veteran. NASVH's WordPress `veterans-homes`
    // collection is the only machine-readable national list; the VA publishes
    // none. Keyless. Addresses only, so the runner geocodes them.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.NASVH_BASE_URL ?? 'https://nasvh.org/wp-json/wp/v2/veterans-homes',
    }),
  },
  'samhsa-veteran-bh': {
    factory: createSamhsaVeteranBehavioralHealthSource,
    // FindTreatment.gov filtered to facilities reporting a veterans program
    // (`sCodes=VET`). Keyless, robots-permitted, and already geocoded. This is
    // the app's only source of non-VA mental health and substance use treatment
    // — before it, `healthcare` was VA facilities and nothing else.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.SAMHSA_LOCATOR_URL ??
        'https://findtreatment.gov/locator/exportsAsJson/v2',
    }),
  },
  'american-job-centers': {
    factory: createAmericanJobCentersSource,
    // The public workforce offices — 2,169 open centres, 1,542 with a dedicated
    // veterans' employment representative (DVOP/LVER). Replaces job *postings*
    // with places a veteran can walk into. Free bulk XLSX, no key, coordinates
    // included. careeronestop.org 403s a default client, so the shared browser
    // User-Agent in lib/http.ts is required. Attribution to DOL ETA + Minnesota
    // DEED is a licence condition and rides in every row's description.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.CAREERONESTOP_AJC_URL ??
        'https://www.careeronestop.org/TridionMultimedia/tcm24-51446_XLS_AJC_Data_ACC.xlsx',
    }),
  },
  'hud-pha': {
    factory: createHudPublicHousingAuthoritiesSource,
    // The 3,776 offices that actually issue HUD-VASH vouchers — the app carried a
    // national HUD-VASH referral for months with nowhere to send anyone. Public
    // ArcGIS layer with LAT/LON and phone; keyless, public domain.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.HUD_PHA_URL ??
        'https://services.arcgis.com/VTyQ9soqVukalItT/ArcGIS/rest/services/Public_Housing_Authorities/FeatureServer/0/query',
    }),
  },
  'catholic-charities': {
    factory: createCatholicCharitiesSource,
    // 168 local agencies, 100% with coordinates and 167 with a phone — rent and
    // utility help, food, clothing, and a caseworker who knows the area. The old
    // /find-help/ URL 301s, which is why earlier audits missed it; the current page
    // embeds the whole list in one JSON tag. robots.txt permits everything.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.CCUSA_DIRECTORY_URL ??
        'https://www.catholiccharitiesusa.org/about-us/find-a-local-agency/',
    }),
  },
  'fta-ntd': {
    factory: createNtdTransitAgenciesSource,
    // 2,914 transit agencies incl. 1,218 rural demand-response providers, plus
    // real per-day service hours for 1,919 of them. transit.dot.gov 403s any
    // non-browser client, which is why this looked inaccessible — the data is open
    // on Socrata with no key. Public domain; attribution: Federal Transit Admin.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.NTD_AGENCIES_URL ?? 'https://data.transportation.gov/resource/ccvf-fykn.json',
    }),
  },
  'va-transportation': {
    factory: createVaTransportationSource,
    // The VA's per-facility Veterans Transportation Program representatives — the
    // answer to "I have an appointment and no way to get there", which the 85
    // travel-reimbursement rows never gave. Keyless, public domain. Phones live in
    // `<va-telephone contact="...">` ATTRIBUTES, so a text-only scrape finds none.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.VA_VTP_URL ??
        'https://www.va.gov/resources/veterans-transportation-program-representatives/',
    }),
  },
  'osm-clothing': {
    factory: createOsmCharityShopsSource,
    // Charity and second-hand shops from OpenStreetMap — the only national answer
    // for `clothing`, which held one row. Includes ~2,252 Goodwill and ~495
    // Salvation Army locations that those organisations' own sites block us from
    // (Goodwill 403s even its robots.txt). Keyless. ODbL: the "© OpenStreetMap
    // contributors" credit is rendered by resourceStatus.ts off the `osm` tag.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
    }),
  },
  'nacvso-cvso': {
    factory: createNacvsoOfficersSource,
    // County Veterans Service Officers — the free, staffed county offices that
    // file VA claims for veterans. The data exists nowhere centrally; NACVSO's
    // member directory is the only national list. Its robots.txt disallows the
    // Novi `/api/` and `/novi-api/` JSON backend (which we never touch) but NOT
    // the rendered profile pages, and it advertises the sitemap that lists them.
    // Read at low concurrency with a delay — ~2,900 pages against a small site.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.NACVSO_SITEMAP_URL ?? 'https://www.nacvso.org/sitemap.xml',
    }),
  },
  'lsc-legal-aid': {
    factory: createLscLegalAidSource,
    // Free civil legal aid. Restores independent content to `legal`, which the
    // audit found was entirely the accredited-rep list cross-listed from
    // benefits_help. Service areas only, no addresses — state-scoped referrals.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.LSC_PROGRAMS_URL ??
        'https://www.lsc.gov/themes/lsc/scripts/find-legal-aid-leaflet/Programs.json',
    }),
  },
  'hrsa-health-centers': {
    factory: createHrsaHealthCentersSource,
    // Federally funded community clinics — sliding-scale care for a veteran who
    // isn't enrolled in VA health care or lives too far from a VA clinic. General
    // under the hybrid rule, and capped in-app so it backs the catalogue up
    // without swamping it. One ~14 MB CSV, keyless, refreshed near-daily.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.HRSA_SITES_URL ??
        'https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv',
    }),
  },
  'fisher-houses': {
    factory: createFisherHousesSource,
    // Free lodging for the family of a hospitalised veteran. Only ~74 houses, but
    // per row the most consequential resource in the catalogue. Undocumented but
    // stable JSON behind the foundation's directory; coordinates included.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.FISHER_HOUSE_URL ?? 'https://www.fisherhouse.org/api/houses/current',
    }),
  },
  'usaspending-va-grants': {
    factory: createUsaspendingVaGranteesSource,
    // The provider directory the VA doesn't publish: organizations holding VA/DOL
    // veteran-services grants, by CFDA number, with recipient addresses. This is
    // how Grant & Per Diem housing gets in without parsing award PDFs. Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.USASPENDING_SEARCH_URL ??
        'https://api.usaspending.gov/api/v2/search/spending_by_award/',
    }),
  },
  'curated-national': {
    factory: createCuratedNationalSource,
    // Reads a local JSON file of hand-verified national resources (no API).
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: resolve(root, 'ingestion/data/curated-national.json'),
    }),
  },
  'ssvf-providers': {
    factory: createSsvfProvidersSource,
    // Reads the converted VA SSVF grantee list (no API — quarterly manual refresh).
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: resolve(root, 'ingestion/data/ssvf-providers.json'),
    }),
  },
  'feed-america': {
    factory: createFeedAmericaFoodSource,
    // Food pantries (open to everyone, labeled). Veterans face food insecurity
    // and no veteran-specific food dataset exists; the in-app cap (nearest ~20)
    // keeps it from dominating. Keyless. National by default as of 2026-07-27 —
    // `--state` now only narrows it for spot-checks. The former 8-state gate
    // left 42 states with no food at all.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.FEEDAM_BASE_URL ?? 'https://feedam.org/hsds/v3',
    }),
  },
};

/** Per-source paging defaults (overridable with --per-page / --max-pages). */
const PAGE_DEFAULTS: Record<string, { perPage: number; maxPages: number }> = {
  // VA GI Bill: ~13.8k schools; the API hard-caps per_page at 10 → ~1,380 pages.
  'gi-bill': { perPage: 10, maxPages: 1500 },
};

function requireEnv(value: string | undefined, name: string, hint: string): string {
  if (!value) {
    console.error(`Missing ${name} (shell env or .env.seed) — ${hint}.`);
    process.exit(1);
  }
  return value;
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

const numberArg = (value: string | boolean | undefined): number | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) {
    console.error(`Invalid numeric flag value: "${value}"`);
    process.exit(1);
  }
  return n;
};

/** Defense-in-depth over what the adapter already guarantees. */
function validate(items: NormalizedResource[]): { valid: NormalizedResource[]; rejected: number } {
  const valid: NormalizedResource[] = [];
  let rejected = 0;
  for (const item of items) {
    const coordsPaired = (item.latitude === null) === (item.longitude === null);
    const coordsSane =
      item.latitude === null || item.longitude === null
        ? true
        : item.latitude >= -90 &&
          item.latitude <= 90 &&
          item.longitude >= -180 &&
          item.longitude <= 180;
    const ok = Boolean(item.id && item.name && item.description && coordsPaired && coordsSane);
    if (ok) {
      valid.push(item);
    } else {
      rejected++;
      console.warn(`[ingest] rejected ${item.id || '(no id)'} — failed validation`);
    }
  }
  return { valid, rejected };
}

async function main(): Promise<void> {
  loadEnvFile(resolve(root, '.env.seed'));
  const args = parseArgs(process.argv.slice(2));

  const sourceKey = typeof args.source === 'string' ? args.source : 'va-facilities';
  const def = SOURCES[sourceKey];
  if (!def) {
    console.error(`Unknown source '${sourceKey}'. Known: ${Object.keys(SOURCES).join(', ')}`);
    process.exit(1);
  }

  const dryRun = Boolean(args['dry-run']);
  const national = Boolean(args.national);
  const pageDefaults = PAGE_DEFAULTS[sourceKey];
  const query: IngestionQuery = {
    lat: numberArg(args.lat),
    long: numberArg(args.long),
    radiusMiles: numberArg(args.radius),
    state: typeof args.state === 'string' ? args.state : undefined,
    national,
    types: typeof args.type === 'string' ? args.type.split(',') : undefined,
    locationName: typeof args.location === 'string' ? args.location : undefined,
    keyword: typeof args.keyword === 'string' ? args.keyword : undefined,
    perPage: numberArg(args['per-page']) ?? pageDefaults?.perPage ?? 100,
    // Nationwide VA needs enough pages for the largest type (~1,400 health rows).
    maxPages: numberArg(args['max-pages']) ?? pageDefaults?.maxPages ?? (national ? 20 : 5),
  };

  const config = def.resolveConfig();
  const source = def.factory(config);
  console.log(`[ingest] source=${source.provider} base=${config.baseUrl} dryRun=${dryRun}`);

  const normalized = await source.fetch(query);
  console.log(`[ingest] normalized ${normalized.length} resources`);

  // Sources with addresses but no provider coordinates (gi-bill) get exact
  // coords from the Census batch geocoder — cache-backed, so it needs the
  // service role. Dry runs skip it: rows print with null coords + `geocode`.
  const needsGeocoding = normalized.some((item) => item.geocode);
  if (needsGeocoding && dryRun) {
    console.log('[ingest] dry run — skipping Census geocoding (rows keep null coords).');
  }

  if (dryRun) {
    const { valid, rejected } = validate(normalized);
    if (rejected > 0) console.warn(`[ingest] rejected ${rejected} invalid row(s)`);
    console.log('[ingest] sample (first 3):');
    console.log(JSON.stringify(valid.slice(0, 3), null, 2));
    console.log(`[ingest] dry run — no writes. ${valid.length} rows ready to upsert.`);
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for the live write. Put them in .env.seed, or pass --dry-run.',
    );
    process.exit(1);
  }
  const admin: AdminConfig = { url, serviceKey };

  if (needsGeocoding) {
    const { matched, unmatched, fromCache } = await geocodeResources(admin, normalized);
    console.log(
      `[ingest] geocoded ${matched} matched / ${unmatched} unmatched (no pin) — ${fromCache} from cache`,
    );
  }

  const { valid, rejected } = validate(normalized);
  if (rejected > 0) console.warn(`[ingest] rejected ${rejected} invalid row(s)`);

  if (valid.length === 0) {
    console.log('[ingest] nothing to write.');
    return;
  }
  await upsertResources(admin, valid);
  console.log(`[ingest] upserted ${valid.length} resources + provenance. Done.`);
}

await main();
