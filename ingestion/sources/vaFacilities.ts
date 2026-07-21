/**
 * VA Lighthouse Facilities API adapter (developer.va.gov).
 *
 * Official, nationwide source of VA health, benefits, and Vet Center locations.
 * Base: https://api.va.gov/services/va_facilities/v1 (sandbox mirror at
 * sandbox-api.va.gov). Auth: an `apikey` header (free key from developer.va.gov).
 * Endpoint: GET /facilities?lat=&long=&radius=&per_page=&page= (or ?state=).
 * Response is JSON:API — `data[].attributes` per facility.
 *
 * Because it's an official API, ingested rows are `source_type: 'official'` /
 * `verification_status: 'verified'` with `last_checked` set to the fetch date:
 * for an official source the fetch IS the confirmation. Field shapes are
 * verified against a live sample (via `--dry-run`) before any bulk write.
 */
import type { ResourceCategory } from '../../src/types/resource.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'va-facilities';
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 4;
// The VA sandbox is rate-limited (~60 req/min); pace paged requests below that.
// Production keys get the full limit, so a shorter default is fine there.
const SANDBOX_THROTTLE_MS = 1_100;
const PROD_THROTTLE_MS = 250;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * VA `facility_type` → our `ResourceCategory`. Types we don't surface as help
 * resources (cemeteries) map to null and are skipped — honest coverage over
 * padded counts. Unknown types are skipped too (conservative).
 */
const CATEGORY_BY_FACILITY_TYPE: Record<string, ResourceCategory | null> = {
  va_health_facility: 'healthcare',
  dod_health_facility: 'healthcare',
  vet_center: 'healthcare', // Vet Centers are readjustment / mental-health counseling
  va_benefits_facility: 'benefits_help',
  va_cemetery: null,
};

interface VaFacility {
  id: string;
  type: string;
  // The VA Facilities API v1 serializes attributes in camelCase.
  attributes: {
    name?: string | null;
    facilityType?: string | null;
    classification?: string | null;
    website?: string | null;
    lat?: number | null;
    long?: number | null;
    address?: {
      physical?: {
        address1?: string | null;
        address2?: string | null;
        address3?: string | null;
        city?: string | null;
        state?: string | null;
        zip?: string | null;
      } | null;
    } | null;
    phone?: { main?: string | null } | null;
    hours?: Record<string, string | null> | null;
  };
}

interface VaResponse {
  data?: VaFacility[];
}

const DAY_ORDER = [
  { key: 'monday', abbr: 'Mon' },
  { key: 'tuesday', abbr: 'Tue' },
  { key: 'wednesday', abbr: 'Wed' },
  { key: 'thursday', abbr: 'Thu' },
  { key: 'friday', abbr: 'Fri' },
  { key: 'saturday', abbr: 'Sat' },
  { key: 'sunday', abbr: 'Sun' },
] as const;

const pad = (n: number): string => String(n).padStart(2, '0');
const toClock = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** Parse a VA time token ("800AM", "8:00AM", "1630") to minutes-from-midnight. */
function parseVaTime(raw: string): number | null {
  const t = raw.trim().toUpperCase().replace(/\s+/g, '');
  const meridiem = t.endsWith('AM') ? 'AM' : t.endsWith('PM') ? 'PM' : null;
  const body = meridiem ? t.slice(0, -2) : t;

  let hour: number;
  let minute: number;
  if (body.includes(':')) {
    const [h, m] = body.split(':');
    hour = Number(h);
    minute = Number(m);
  } else if (/^\d{3,4}$/.test(body)) {
    hour = Number(body.slice(0, body.length - 2));
    minute = Number(body.slice(-2));
  } else if (/^\d{1,2}$/.test(body)) {
    hour = Number(body);
    minute = 0;
  } else {
    return null;
  }

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return null;
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour > 23) return null;
  return hour * 60 + minute;
}

/** One VA day value ("800AM-430PM", "Closed", "24/7") → "HH:MM-HH:MM" or null. */
function parseVaDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || /closed|^-$/i.test(v)) return null;
  if (/24\s*\/?\s*7|24 hours/i.test(v)) return '00:00-23:59';

  const match = v.match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) return null;
  const start = parseVaTime(match[1]);
  const end = parseVaTime(match[2]);
  if (start === null || end === null || end <= start) return null;
  return `${toClock(start)}-${toClock(end)}`;
}

/**
 * VA's per-day hours object → the app's controlled hours string
 * (`Mon-Fri 08:00-16:30; Sat 09:00-13:00`, understood by `src/lib/hours.ts`).
 * Consecutive days with identical ranges collapse into a range. Days we can't
 * confidently parse are omitted; if none parse we return null ("unknown") — a
 * wrong "open now" is worse than an honest unknown.
 */
function vaHoursToControlled(hours: Record<string, string | null> | null | undefined): string | null {
  if (!hours) return null;
  const byLowerKey: Record<string, string | null> = {};
  for (const [k, val] of Object.entries(hours)) byLowerKey[k.toLowerCase()] = val;

  const parsed = DAY_ORDER.map((d) => ({ abbr: d.abbr, range: parseVaDay(byLowerKey[d.key]) }));

  const groups: string[] = [];
  let i = 0;
  while (i < parsed.length) {
    const { range } = parsed[i];
    if (!range) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < parsed.length && parsed[j + 1].range === range) j++;
    const label = i === j ? parsed[i].abbr : `${parsed[i].abbr}-${parsed[j].abbr}`;
    groups.push(`${label} ${range}`);
    i = j + 1;
  }
  return groups.length > 0 ? groups.join('; ') : null;
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

function buildAddress(physical: NonNullable<VaFacility['attributes']['address']>['physical']): string | null {
  if (!physical) return null;
  const street = [physical.address1, physical.address2, physical.address3]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
  const region = [physical.state?.trim(), physical.zip?.trim()].filter(Boolean).join(' ');
  const cityRegion = [physical.city?.trim(), region].filter(Boolean).join(', ');
  const full = [street, cityRegion].filter(Boolean).join(', ');
  return full.length > 0 ? full : null;
}

function isSaneCoord(lat: number | null | undefined, long: number | null | undefined): boolean {
  if (typeof lat !== 'number' || typeof long !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(long)) return false;
  if (lat < -90 || lat > 90 || long < -180 || long > 180) return false;
  return lat !== 0 || long !== 0; // (0,0) is the null-island sentinel, never a VA site
}

/**
 * Plain-English card description + eligibility for a VA facility. The API's
 * `classification` is jargon ("Multi-Specialty CBOC", "OOS") that means nothing
 * to a veteran, so we translate it into what you can actually get there.
 */
function describeVaFacility(
  facilityType: string,
  classification: string | null,
): { description: string; eligibility: string | null } {
  const cls = (classification ?? '').toLowerCase();

  if (facilityType === 'vet_center') {
    return {
      description:
        'Vet Center — free, confidential counseling and readjustment support for combat veterans, service members, and their families.',
      eligibility:
        'For combat veterans, service members, and their families. No VA enrollment or appointment needed to get started.',
    };
  }

  if (facilityType === 'va_benefits_facility') {
    if (cls.includes('pre-discharge')) {
      return {
        description:
          'VA pre-discharge site — helps transitioning service members file benefit claims before they leave the military.',
        eligibility: 'For service members preparing to separate or retire from active duty.',
      };
    }
    return {
      description:
        'VA benefits office — in-person help understanding and applying for VA benefits like disability compensation, pension, and the GI Bill.',
      eligibility: 'Open to veterans and eligible family members. Bring your DD-214 if you have one.',
    };
  }

  // Health facilities (VA or DoD): name the kind of clinic in plain language.
  const kind = cls.includes('medical center')
    ? 'medical center'
    : cls.includes('health care center')
      ? 'health care center'
      : cls.includes('cboc') || cls.includes('outpatient')
        ? 'outpatient clinic'
        : 'health clinic';
  return {
    description: `VA ${kind} providing medical care and health services to enrolled veterans.`,
    eligibility:
      'Open to enrolled veterans. Call ahead to confirm services and whether you need an appointment.',
  };
}

/** VA facility → our `Resource`, or null if it isn't a usable help resource. */
function normalize(facility: VaFacility, today: string): NormalizedResource | null {
  const a = facility.attributes;
  const facilityType = a.facilityType ?? '';
  const category = CATEGORY_BY_FACILITY_TYPE[facilityType] ?? null;
  if (!category) return null; // cemeteries / unknown types
  if (!isSaneCoord(a.lat, a.long)) return null; // a located resource needs real coords

  const name = trimOrNull(a.name);
  if (!name) return null;

  const classification = trimOrNull(a.classification);
  const website = trimOrNull(a.website);
  const tags = [facilityType, classification].filter((t): t is string => Boolean(t));
  const { description, eligibility } = describeVaFacility(facilityType, classification);

  return {
    id: `va:${facility.id}`,
    name,
    category,
    description,
    address: buildAddress(a.address?.physical),
    latitude: a.lat as number,
    longitude: a.long as number,
    phone: trimOrNull(a.phone?.main),
    website,
    hours: vaHoursToControlled(a.hours),
    eligibility,
    documents_needed: [],
    source_url: website,
    source_type: 'official',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags,
    created_at: today,
    updated_at: today,
    external_id: facility.id,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: facility,
  };
}

// Response `facilityType` values → the `?type=` param values used for nationwide
// pulls. We ingest the three usable types (cemeteries are skipped downstream).
const NATIONAL_TYPES = ['health', 'benefits', 'vet_center'] as const;

function buildUrl(baseUrl: string, query: IngestionQuery, page: number, typeFilter?: string): string {
  const params = new URLSearchParams({ per_page: String(query.perPage), page: String(page) });
  if (typeFilter) {
    // Nationwide-by-type: no geo filter.
    params.set('type', typeFilter);
  } else if (typeof query.lat === 'number' && typeof query.long === 'number') {
    params.set('lat', String(query.lat));
    params.set('long', String(query.long));
    if (typeof query.radiusMiles === 'number') params.set('radius', String(query.radiusMiles));
  } else if (query.state) {
    params.set('state', query.state);
  } else {
    throw new Error(
      'VA Facilities needs a scope: pass --national, or --lat/--long (with optional --radius), or --state.',
    );
  }
  return `${baseUrl.replace(/\/$/, '')}/facilities?${params.toString()}`;
}

async function fetchOnce(url: string, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { apikey: apiKey, accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch one page, retrying on HTTP 429 with Retry-After / exponential backoff. */
async function fetchPage(url: string, apiKey: string, maxRetries: number): Promise<VaFacility[]> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetchOnce(url, apiKey);

    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const backoffMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(30_000, 1000 * 2 ** attempt); // 1s, 2s, 4s, 8s…
      console.warn(
        `[ingest] 429 rate-limited — backing off ${Math.round(backoffMs / 1000)}s (retry ${attempt + 1}/${maxRetries})`,
      );
      await sleep(backoffMs);
      continue;
    }
    if (!response.ok) {
      throw new Error(`VA Facilities API ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as VaResponse;
    return body.data ?? [];
  }
}

export const createVaFacilitiesSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  const isSandbox = /sandbox/i.test(config.baseUrl);
  const throttleMs = config.throttleMs ?? (isSandbox ? SANDBOX_THROTTLE_MS : PROD_THROTTLE_MS);
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const results: NormalizedResource[] = [];
      const seen = new Set<string>();

      // Nationwide mode pages through each usable facility type; otherwise a
      // single geo (lat/long or state) query. `undefined` = no type filter.
      const segments: (string | undefined)[] = query.national
        ? (query.types ?? [...NATIONAL_TYPES])
        : [undefined];

      let first = true;
      for (const typeFilter of segments) {
        for (let page = 1; page <= query.maxPages; page++) {
          if (!first && throttleMs > 0) await sleep(throttleMs); // pace under the rate limit
          first = false;
          const url = buildUrl(config.baseUrl, query, page, typeFilter);
          const facilities = await fetchPage(url, config.apiKey, maxRetries);
          for (const facility of facilities) {
            if (seen.has(facility.id)) continue;
            seen.add(facility.id);
            const normalized = normalize(facility, today);
            if (normalized) results.push(normalized);
          }
          if (facilities.length < query.perPage) break; // last page of this segment
        }
      }
      return results;
    },
  };
};
