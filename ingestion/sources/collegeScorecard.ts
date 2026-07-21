/**
 * College Scorecard adapter (api.data.gov, U.S. Dept. of Education).
 *
 * Official, nationwide source of **colleges and universities** — relevant to
 * veterans using the GI Bill and VA education benefits. Fills the `education`
 * category with national coverage so any ZIP works.
 *
 * Base: https://api.data.gov/ed/collegescorecard/v1/schools. Auth: a free
 * DATA.gov API key on the `api_key` query param (one key unlocks many federal
 * APIs; `DEMO_KEY` works for low-volume testing). Called with `school.operating=1`
 * and no geo filter → the whole operating-school set (~6.2k), paginated.
 * ⚠️ `page` is **0-indexed**; `metadata.total` gives the row count.
 *
 * Field selection uses the API's flattened dot-notation (`school.name`,
 * `location.lat`, …). Official → `source_type: 'official'` /
 * `verification_status: 'verified'`, `last_checked` = fetch date. Shapes are
 * verified against a live sample (via `--dry-run`) before any write.
 */
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'college-scorecard';
const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 3;
const THROTTLE_MS = 250;

const FIELDS = [
  'id',
  'school.name',
  'school.address',
  'school.city',
  'school.state',
  'school.zip',
  'school.school_url',
  'school.ownership',
  'location.lat',
  'location.lon',
  'latest.student.size',
].join(',');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** One school, in the API's flattened dot-notation keys (only what we read). */
interface ScorecardSchool {
  id?: number | null;
  'school.name'?: string | null;
  'school.address'?: string | null;
  'school.city'?: string | null;
  'school.state'?: string | null;
  'school.zip'?: string | null;
  'school.school_url'?: string | null;
  'school.ownership'?: number | null;
  'location.lat'?: number | null;
  'location.lon'?: number | null;
  'latest.student.size'?: number | null;
}

interface ScorecardResponse {
  metadata?: { total?: number; page?: number; per_page?: number };
  results?: ScorecardSchool[];
}

// School Scorecard ownership codes → plain English.
const OWNERSHIP: Record<number, string> = {
  1: 'Public',
  2: 'Private nonprofit',
  3: 'Private for-profit',
};

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

function normalizeUrl(raw: string | null | undefined): string | null {
  const v = trimOrNull(raw);
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return withScheme.replace(/\/+$/, '');
}

function isSaneCoord(lat: number | null | undefined, long: number | null | undefined): boolean {
  if (typeof lat !== 'number' || typeof long !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(long)) return false;
  if (lat < -90 || lat > 90 || long < -180 || long > 180) return false;
  return lat !== 0 || long !== 0;
}

function buildAddress(s: ScorecardSchool): string | null {
  const region = [s['school.state']?.trim(), s['school.zip']?.trim()].filter(Boolean).join(' ');
  const cityRegion = [s['school.city']?.trim(), region].filter(Boolean).join(', ');
  const full = [s['school.address']?.trim(), cityRegion].filter(Boolean).join(', ');
  return full.length > 0 ? full : null;
}

function describe(s: ScorecardSchool): string {
  const kind = OWNERSHIP[s['school.ownership'] ?? 0] ?? 'Accredited';
  const size = s['latest.student.size'];
  const scale = typeof size === 'number' && size > 0 ? ` (~${size.toLocaleString('en-US')} students)` : '';
  return `${kind} college or university${scale}. Veterans may cover tuition with the GI Bill and VA education benefits — confirm the school is VA-approved.`;
}

/** Scorecard school → our `Resource`, or null if it isn't usable. */
function normalize(s: ScorecardSchool, today: string): NormalizedResource | null {
  const id = s.id;
  const name = trimOrNull(s['school.name']);
  if (typeof id !== 'number' || !name) return null;
  if (!isSaneCoord(s['location.lat'], s['location.lon'])) return null;

  const website = normalizeUrl(s['school.school_url']);
  const externalId = String(id);

  return {
    id: `scorecard:${externalId}`,
    name,
    category: 'education',
    description: describe(s),
    address: buildAddress(s),
    latitude: s['location.lat'] as number,
    longitude: s['location.lon'] as number,
    phone: null,
    website,
    hours: null,
    eligibility:
      'Veterans may use the GI Bill and VA education benefits here. Confirm the school’s VA certification and your remaining entitlement.',
    documents_needed: [],
    source_url: website,
    source_type: 'official',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['college', 'gi-bill'],
    created_at: today,
    updated_at: today,
    external_id: externalId,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: s,
  };
}

function buildUrl(baseUrl: string, apiKey: string, perPage: number, pageZeroBased: number): string {
  const params = new URLSearchParams({
    api_key: apiKey,
    per_page: String(perPage),
    page: String(pageZeroBased),
    fields: FIELDS,
    'school.operating': '1', // exclude closed schools
  });
  return `${baseUrl.replace(/\/$/, '')}?${params.toString()}`;
}

async function fetchPage(url: string, maxRetries: number): Promise<ScorecardResponse> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429 && attempt < maxRetries) {
      const backoffMs = Math.min(30_000, 1000 * 2 ** attempt);
      console.warn(`[ingest] scorecard 429 — backing off ${Math.round(backoffMs / 1000)}s`);
      await sleep(backoffMs);
      continue;
    }
    if (!response.ok) {
      throw new Error(`College Scorecard API ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as ScorecardResponse;
  }
}

export const createCollegeScorecardSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const throttleMs = config.throttleMs ?? THROTTLE_MS;

  return {
    provider: PROVIDER,
    // National: page the whole operating-school set; the app filters by ZIP.
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const results: NormalizedResource[] = [];
      const seen = new Set<string>();

      for (let page = 0; page < query.maxPages; page++) {
        if (page > 0 && throttleMs > 0) await sleep(throttleMs);
        const body = await fetchPage(buildUrl(config.baseUrl, config.apiKey, query.perPage, page), maxRetries);
        const schools = body.results ?? [];
        for (const school of schools) {
          const normalized = normalize(school, today);
          if (!normalized || seen.has(normalized.id)) continue;
          seen.add(normalized.id);
          results.push(normalized);
        }
        // Stop when this page is the last (fewer than a full page returned).
        if (schools.length < query.perPage) break;
      }
      return results;
    },
  };
};
