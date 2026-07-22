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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createVaFacilitiesSource } from './sources/vaFacilities.ts';
import { createUsaJobsSource } from './sources/usaJobs.ts';
import { createHudCounselingSource } from './sources/hudCounseling.ts';
import { createHrsaHealthCentersSource } from './sources/hrsaHealthCenters.ts';
import { createSamhsaTreatmentSource } from './sources/samhsaTreatment.ts';
import { createCollegeScorecardSource } from './sources/collegeScorecard.ts';
import { createLscLegalAidSource } from './sources/lscLegalAid.ts';
import { upsertResources, type AdminConfig } from './upsert.ts';
import type { IngestionQuery, NormalizedResource, SourceConfig, SourceFactory } from './types.ts';

const root = resolve(import.meta.dirname, '..');
const VA_SANDBOX_BASE = 'https://sandbox-api.va.gov/services/va_facilities/v1';
const USAJOBS_BASE = 'https://data.usajobs.gov/api';
const HUD_HCS_BASE = 'https://data.hud.gov/Housing_Counselor';
const HRSA_CSV_URL =
  'https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv';
const SAMHSA_BASE = 'https://findtreatment.gov/locator/exportsAsJson/v2';
const SCORECARD_BASE = 'https://api.data.gov/ed/collegescorecard/v1/schools';
const LSC_BASE =
  'https://services3.arcgis.com/n7h3cEoHTyNCwjCf/arcgis/rest/services/LSC_offices_grantees_main_branch_(Public)/FeatureServer/0';

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
  usajobs: {
    factory: createUsaJobsSource,
    resolveConfig: () => ({
      apiKey: requireEnv(process.env.USAJOBS_API_KEY, 'USAJOBS_API_KEY', 'a free key from developer.usajobs.gov'),
      baseUrl: process.env.USAJOBS_BASE_URL ?? USAJOBS_BASE,
      userAgent: requireEnv(process.env.USAJOBS_USER_AGENT, 'USAJOBS_USER_AGENT', 'the email the USAJOBS key is registered to'),
    }),
  },
  'hud-housing': {
    factory: createHudCounselingSource,
    // HUD's housing-counselor locator is public and keyless — no secret to read.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.HUD_HCS_BASE_URL ?? HUD_HCS_BASE,
    }),
  },
  'hrsa-health': {
    factory: createHrsaHealthCentersSource,
    // HRSA's national CSV download is public and keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.HRSA_CSV_URL ?? HRSA_CSV_URL,
    }),
  },
  'samhsa-treatment': {
    factory: createSamhsaTreatmentSource,
    // FindTreatment.gov's export endpoint is public and keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.SAMHSA_BASE_URL ?? SAMHSA_BASE,
    }),
  },
  'college-scorecard': {
    factory: createCollegeScorecardSource,
    resolveConfig: () => ({
      apiKey: requireEnv(
        process.env.DATA_GOV_API_KEY,
        'DATA_GOV_API_KEY',
        'a free key from api.data.gov/signup (DEMO_KEY works for testing)',
      ),
      baseUrl: process.env.SCORECARD_BASE_URL ?? SCORECARD_BASE,
    }),
  },
  'lsc-legal': {
    factory: createLscLegalAidSource,
    // LSC's public ArcGIS feature server is keyless.
    resolveConfig: () => ({
      apiKey: '',
      baseUrl: process.env.LSC_BASE_URL ?? LSC_BASE,
    }),
  },
};

/** Per-source paging defaults (overridable with --per-page / --max-pages). */
const PAGE_DEFAULTS: Record<string, { perPage: number; maxPages: number }> = {
  usajobs: { perPage: 25, maxPages: 4 },
  // SAMHSA national sweep: ~45k records at 500/page ≈ 92 pages.
  'samhsa-treatment': { perPage: 500, maxPages: 120 },
  // College Scorecard: ~6.2k operating schools at 100/page ≈ 63 pages.
  'college-scorecard': { perPage: 100, maxPages: 80 },
};

function requireEnv(value: string | undefined, name: string, hint: string): string {
  if (!value) {
    console.error(`Missing ${name} (shell env or .env.seed) — ${hint}.`);
    process.exit(1);
  }
  return value;
}

/** Load KEY=value lines from a git-ignored env file, without clobbering the shell. */
function loadEnvFile(file: string): void {
  try {
    const raw = readFileSync(resolve(root, file), 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // No .env.seed — fine, the shell env may carry the values.
  }
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

const numberArg = (value: string | boolean | undefined): number | undefined =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : undefined;

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
  loadEnvFile('.env.seed');
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
  const { valid, rejected } = validate(normalized);
  if (rejected > 0) console.warn(`[ingest] rejected ${rejected} invalid row(s)`);

  if (dryRun) {
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

  if (valid.length === 0) {
    console.log('[ingest] nothing to write.');
    return;
  }
  await upsertResources(admin, valid);
  console.log(`[ingest] upserted ${valid.length} resources + provenance. Done.`);
}

await main();
