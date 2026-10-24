/**
 * VA Lighthouse Facilities API adapter (developer.va.gov).
 *
 * Official, nationwide source of VA health, benefits, and Vet Center locations.
 * Base: https://api.va.gov/services/va_facilities/v1 (sandbox mirror at
 * sandbox-api.va.gov). Auth: an `apikey` header (free key from developer.va.gov).
 * Endpoint: GET /facilities?lat=&long=&radius=&per_page=&page= (or ?state=).
 * Response is JSON:API — `data[].attributes` per facility.
 *
 * Official API, so rows are `verified` with `last_checked` = the fetch date: for
 * an official source the fetch is the confirmation.
 */
import type { ResourceCategory } from '../../src/types/resource.ts';
import { sleep } from '../lib/http.ts';
import { isSaneCoord, trimOrNull } from '../lib/normalize.ts';
import { fromVaHours } from '../lib/openingHours.ts';
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

/**
 * VA `facility_type` → our `ResourceCategory`; unknown types are skipped.
 * Cemeteries count: burial and survivor benefits are something older veterans
 * and their families need to plan.
 */
const CATEGORY_BY_FACILITY_TYPE: Record<string, ResourceCategory | null> = {
  va_health_facility: 'healthcare',
  dod_health_facility: 'healthcare',
  vet_center: 'healthcare', // Vet Centers are readjustment / mental-health counseling
  va_benefits_facility: 'benefits_help',
  va_cemetery: 'community_support',
};

/**
 * Health services that put a facility in a second category too — e.g. a medical
 * centre with a homeless program is a real, located veteran housing resource.
 * "Nutrition, food, and dietary care" is deliberately NOT mapped: it is clinical
 * dietetics, not a food pantry.
 */
const CROSS_LIST_BY_SERVICE: { service: string; category: ResourceCategory }[] = [
  { service: 'Homeless Veteran care', category: 'housing' },
  { service: 'CaregiverSupport', category: 'community_support' },
  { service: 'Social work', category: 'community_support' },
  { service: 'Emergency care', category: 'emergency' },
  { service: 'Urgent care', category: 'emergency' },
  { service: 'Travel reimbursement', category: 'transportation' },
];

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
    // `main` is absent on some clinics; the coordinator lines are still a real
    // human who can route a veteran, which beats showing no number at all.
    phone?: {
      main?: string | null;
      patientAdvocate?: string | null;
      enrollmentCoordinator?: string | null;
    } | null;
    hours?: Record<string, string | null> | null;
    /** Health facilities list the services they actually offer; we cross-list
     *  off these so thin categories hold real VA places. */
    services?: { health?: { name?: string | null }[] | null } | null;
  };
}

interface VaResponse {
  data?: VaFacility[];
}

function buildAddress(
  physical: NonNullable<VaFacility['attributes']['address']>['physical'],
): string | null {
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

  if (facilityType === 'va_cemetery') {
    return {
      description:
        'VA national cemetery — burial space, headstones and markers, and a Presidential Memorial Certificate, at no cost to the family of an eligible veteran.',
      eligibility:
        'For veterans discharged under conditions other than dishonorable, and often their spouse and dependent children. Call the cemetery to confirm eligibility and arrange a burial — you do not need to apply in advance.',
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
      eligibility:
        'Open to veterans and eligible family members. Bring your DD-214 if you have one.',
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
  if (!category) return null; // unknown facility type
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
    // An older veteran's first move is to call. Where a clinic publishes no main
    // line, a coordinator who can route them beats an empty phone field.
    phone:
      trimOrNull(a.phone?.main) ??
      trimOrNull(a.phone?.patientAdvocate) ??
      trimOrNull(a.phone?.enrollmentCoordinator),
    website,
    hours: fromVaHours(a.hours),
    eligibility,
    documents_needed: [],
    source_url: website,
    source_type: 'official',
    veteran_relevance: 'veteran_specific', // VA facilities exist to serve veterans
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

/**
 * Vet Centers are counseling-first, so they live in `healthcare` — but they are
 * also the closest thing the VA has to a local veteran community hub (peer
 * support, family readjustment, someone to talk to). Cross-list each one into
 * `community_support` as a second row so that category holds real, nearby
 * places instead of only national hotlines. Distinct id/external_id keeps the
 * provenance rows separate.
 */
function crossListVetCenter(base: NormalizedResource): NormalizedResource {
  return {
    ...base,
    id: `${base.id}:community`,
    external_id: `${base.external_id}:community`,
    category: 'community_support',
    description:
      'Vet Center — a local hub for veteran peer support: free, confidential readjustment counseling for combat veterans, service members, and their families.',
    eligibility:
      'For combat veterans, service members, and their families. No VA enrollment or appointment needed — walk in or call.',
    tags: [...base.tags, 'community-support'],
  };
}

/** Copy describing what a cross-listed service actually offers, so the second
 *  row reads as that service rather than as a duplicate of the medical centre. */
const SERVICE_COPY: Record<string, { description: string; eligibility: string }> = {
  'Homeless Veteran care': {
    description:
      'VA homeless program — help for veterans who are homeless or about to lose housing: emergency and transitional housing referrals, HUD-VASH vouchers, and case management.',
    eligibility:
      'For veterans who are homeless or at risk of becoming homeless. Walk in or call — you do not need to be enrolled in VA health care first.',
  },
  CaregiverSupport: {
    description:
      'VA Caregiver Support Program — a caregiver support coordinator who helps the family member looking after a veteran: training, respite care, counseling, and possible stipends.',
    eligibility:
      'For family members and friends caring for a veteran. Ask for the Caregiver Support Coordinator.',
  },
  'Social work': {
    description:
      'VA social work services — a social worker who helps a veteran sort out housing, benefits, transportation, home care, and family support alongside their medical care.',
    eligibility:
      'For enrolled veterans. Ask your care team for a social work referral, or call ahead.',
  },
  'Emergency care': {
    description:
      'VA emergency department — 24/7 emergency care for a serious or life-threatening condition.',
    eligibility:
      'In an emergency, go to the nearest emergency room or call 911 — do not travel further to reach a VA hospital. VA may help cover emergency care at a non-VA hospital; tell VA within 72 hours.',
  },
  'Urgent care': {
    description:
      'VA urgent care — same-day care for something that needs attention today but is not life-threatening, like a sprain, a bad cough, or a minor infection.',
    eligibility:
      'For enrolled veterans who have used VA health care in the past 24 months. Call ahead to confirm hours. For anything life-threatening, call 911 instead.',
  },
  'Travel reimbursement': {
    description:
      'VA beneficiary travel — money back for mileage, and sometimes tolls, parking, or a ride, when you travel to a VA appointment. Some sites also arrange transport for veterans who cannot drive.',
    eligibility:
      'For veterans who qualify on service-connected disability, income, or certain other grounds. Ask the travel office before your appointment — most claims must be filed within 30 days.',
  },
};

/**
 * A second row for a facility that also runs a named service, so categories with
 * almost no local veteran places hold real, nearby VA sites. Same physical
 * location and phone, re-described as that service. Generalizes the Vet Center
 * cross-list above; distinct id/external_id keeps provenance rows separate.
 */
function crossListService(
  base: NormalizedResource,
  service: string,
  category: ResourceCategory,
): NormalizedResource {
  const slug = service.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const copy = SERVICE_COPY[service];
  return {
    ...base,
    id: `${base.id}:${slug}`,
    external_id: `${base.external_id}:${slug}`,
    category,
    name: `${base.name} — ${service}`,
    description: copy?.description ?? base.description,
    eligibility: copy?.eligibility ?? base.eligibility,
    tags: [...base.tags, slug],
  };
}

// Response `facilityType` values → the `?type=` param values used for nationwide
// pulls.
const NATIONAL_TYPES = ['health', 'benefits', 'vet_center', 'cemetery'] as const;

function buildUrl(
  baseUrl: string,
  query: IngestionQuery,
  page: number,
  typeFilter?: string,
): string {
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
            if (!normalized) continue;
            results.push(normalized);
            if (facility.attributes.facilityType === 'vet_center') {
              results.push(crossListVetCenter(normalized));
            }
            const offered = new Set(
              (facility.attributes.services?.health ?? [])
                .map((s) => trimOrNull(s?.name))
                .filter((n): n is string => Boolean(n)),
            );
            for (const { service, category } of CROSS_LIST_BY_SERVICE) {
              if (offered.has(service)) {
                results.push(crossListService(normalized, service, category));
              }
            }
          }
          if (facilities.length < query.perPage) break; // last page of this segment
        }
      }
      return results;
    },
  };
};
