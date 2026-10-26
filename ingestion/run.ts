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
// VA facility data is public, so the sandbox host mirrors production in full. The
// free developer.va.gov key is sandbox-scoped (api.va.gov 401s it), so do not
// change this default without provisioning a production key.
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
    // HUD's housing-counselor locator: public, keyless, `general`.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.HUD_HCS_BASE_URL ?? HUD_HCS_BASE,
    }),
  },
  'vso-organizations': {
    factory: createVsoOrganizationsSource,
    // VA OGC's accredited-organization export, rolled up to organization × state. Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.VA_OGC_ORGS_URL ??
        'https://www.va.gov/ogc/apps/accreditation/orgsexcellist.asp',
    }),
  },
  'state-veterans-homes': {
    factory: createStateVeteransHomesSource,
    // NASVH's WordPress `veterans-homes` collection. Keyless; addresses only, so geocoded.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.NASVH_BASE_URL ?? 'https://nasvh.org/wp-json/wp/v2/veterans-homes',
    }),
  },
  'samhsa-veteran-bh': {
    factory: createSamhsaVeteranBehavioralHealthSource,
    // FindTreatment.gov filtered to facilities with a veterans program. Keyless, geocoded.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.SAMHSA_LOCATOR_URL ?? 'https://findtreatment.gov/locator/exportsAsJson/v2',
    }),
  },
  'american-job-centers': {
    factory: createAmericanJobCentersSource,
    // CareerOneStop's bulk AJC workbook. Keyless; needs lib/http.ts's browser User-Agent.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.CAREERONESTOP_AJC_URL ??
        'https://www.careeronestop.org/TridionMultimedia/tcm24-51446_XLS_AJC_Data_ACC.xlsx',
    }),
  },
  'hud-pha': {
    factory: createHudPublicHousingAuthoritiesSource,
    // HUD's public ArcGIS layer of housing authorities (LAT/LON + phone). Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.HUD_PHA_URL ??
        'https://services.arcgis.com/VTyQ9soqVukalItT/ArcGIS/rest/services/Public_Housing_Authorities/FeatureServer/0/query',
    }),
  },
  'catholic-charities': {
    factory: createCatholicCharitiesSource,
    // The directory page embeds the whole agency list in one JSON tag. Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.CCUSA_DIRECTORY_URL ??
        'https://www.catholiccharitiesusa.org/about-us/find-a-local-agency/',
    }),
  },
  'fta-ntd': {
    factory: createNtdTransitAgenciesSource,
    // FTA National Transit Database on Socrata (transit.dot.gov 403s non-browsers). Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.NTD_AGENCIES_URL ?? 'https://data.transportation.gov/resource/ccvf-fykn.json',
    }),
  },
  'va-transportation': {
    factory: createVaTransportationSource,
    // The VA's Veterans Transportation Program representatives page. Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.VA_VTP_URL ??
        'https://www.va.gov/resources/veterans-transportation-program-representatives/',
    }),
  },
  'osm-clothing': {
    factory: createOsmCharityShopsSource,
    // Charity and second-hand shops from OpenStreetMap (Overpass). Keyless; ODbL.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
    }),
  },
  'nacvso-cvso': {
    factory: createNacvsoOfficersSource,
    // NACVSO's member directory, read from its sitemap at low concurrency. Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.NACVSO_SITEMAP_URL ?? 'https://www.nacvso.org/sitemap.xml',
    }),
  },
  'lsc-legal-aid': {
    factory: createLscLegalAidSource,
    // LSC grantees — free civil legal aid, as state-scoped referrals. Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.LSC_PROGRAMS_URL ??
        'https://www.lsc.gov/themes/lsc/scripts/find-legal-aid-leaflet/Programs.json',
    }),
  },
  'hrsa-health-centers': {
    factory: createHrsaHealthCentersSource,
    // HRSA health-centre site file (~14 MB CSV, streamed). Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl:
        process.env.HRSA_SITES_URL ??
        'https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv',
    }),
  },
  'fisher-houses': {
    factory: createFisherHousesSource,
    // The undocumented but stable JSON behind Fisher House's directory. Keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.FISHER_HOUSE_URL ?? 'https://www.fisherhouse.org/api/houses/current',
    }),
  },
  'usaspending-va-grants': {
    factory: createUsaspendingVaGranteesSource,
    // USAspending award search by CFDA number (VA/DOL veteran-services grants). Keyless.
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
    // Feed America's HSDS feed. Keyless; national, `--state` narrows it for spot-checks.
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
