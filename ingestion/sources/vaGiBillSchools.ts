/**
 * VA GI Bill schools adapter (GI Bill Comparison Tool API).
 *
 * Veteran-focused, not just GI-Bill-approved: we keep only schools that do more
 * for veterans than accept the benefit — Yellow Ribbon funding, a Student
 * Veteran Group, or VET TEC (see `isVeteranFocused`). This narrows the raw list
 * from ~12.8k general colleges to ~2.8k genuinely veteran-supportive campuses
 * (decision 2026-07-24 — the unfiltered set was bloat). `veteran_benefit`.
 *
 * Source: the keyless VA GI Bill Comparison Tool institutions API,
 * `https://api.va.gov/v0/gi/institutions/search?per_page=&page=` (JSON:API,
 * `data[].attributes`). It lists ~33k approved institutions; we keep the ones
 * that are actual schools (`type` public / private / for profit), US-based,
 * not online-only, AND veteran-focused — excluding OJT (~19k), flight, foreign,
 * correspondence, and general colleges with no veteran commitment.
 * The list has full street addresses but **no coordinates** (and no phone; the
 * `insturl` website field is often absent from the current payload). Rows are
 * emitted with null coords + `geocode` address parts; the runner resolves them
 * to exact coordinates via the Census batch geocoder, and addresses that don't
 * match stay null — listed, never pinned at an approximate spot.
 *
 * Official → `source_type:'official'` / `verification_status:'verified'`.
 * Shapes verified against a live sample (via `--dry-run`) before any write.
 */
import { fetchJson } from '../lib/http.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'va-gi-bill';
const REQUEST_TIMEOUT_MS = 30_000;
// The API caps per_page at 10, so ~1,380 pages — fetch them in parallel chunks
// (compute the page count from meta.count) and retry hard, so it finishes fast
// and a transient timeout can't kill the whole run.
const DEFAULT_MAX_RETRIES = 6;
const CONCURRENCY = 15;
/** College Scorecard: website + coordinates, joined on the IPEDS UNITID. */
const SCORECARD_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools';
const THROTTLE_MS = 120;

// Institution `type` values we keep — real schools a veteran attends. OJT,
// flight, foreign, and correspondence are approved too but aren't campus schools.
const SCHOOL_TYPES = new Set(['public', 'private', 'for profit']);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface GiAttributes {
  name?: string | null;
  facility_code?: string | null;
  type?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  physical_address_1?: string | null;
  physical_city?: string | null;
  physical_state?: string | null;
  physical_zip?: string | null;
  physical_country?: string | null;
  online_only?: boolean | null;
  distance_learning?: boolean | null;
  yr?: boolean | null; // Yellow Ribbon program (extra tuition beyond the GI Bill cap)
  student_veteran?: boolean | null; // has an organized Student Veteran Group
  vet_tec_provider?: boolean | null; // VET TEC veteran tech-training provider
  insturl?: string | null;
}

/**
 * Veteran-specific gate: keep only schools that materially do more for veterans
 * than accept the benefit — Yellow Ribbon funding, an organized Student Veteran
 * Group, or a VET TEC program. Decision 2026-07-24: the raw GI Bill list (~12.8k
 * general colleges) was bloat; this narrows education to the ~2.8k campuses with
 * a real veteran commitment. (Weaker signals — Principles of Excellence, 8 Keys
 * — are deliberately excluded.)
 */
function isVeteranFocused(a: GiAttributes): boolean {
  return Boolean(a.yr || a.student_veteran || a.vet_tec_provider);
}

interface GiResponse {
  data?: { attributes?: GiAttributes }[];
  meta?: { count?: number };
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

/** VA data is ALL-CAPS; title-case for display, keeping small joining words low. */
const SMALL = new Set(['of', 'the', 'and', 'at', 'in', 'for', 'a', 'an', 'on']);
function titleCase(s: string): string {
  const words = s.toLowerCase().split(/\s+/);
  return words
    .map((w, i) => {
      if (i !== 0 && SMALL.has(w)) return w;
      // Keep short all-caps acronyms uppercase (e.g. "UCLA" won't survive lowercasing,
      // so this is best-effort); capitalize the first letter otherwise.
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function normalizeUrl(raw: string | null | undefined): string | null {
  const v = trimOrNull(raw);
  if (!v) return null;
  return (/^https?:\/\//i.test(v) ? v : `https://${v}`).replace(/\/+$/, '');
}

function describe(a: GiAttributes): string {
  // VA `type` is upper-case ("PUBLIC"/"PRIVATE"/"FOR PROFIT") — lower-case
  // before comparing, or every school reads as "private for-profit".
  const t = (a.type ?? '').toLowerCase();
  const kind =
    t === 'public' ? 'public' : t === 'private' ? 'private nonprofit' : 'private for-profit';
  // Every kept school clears isVeteranFocused(), so name the veteran feature.
  const features: string[] = [];
  if (a.yr)
    features.push('the Yellow Ribbon program (extra tuition coverage beyond the GI Bill cap)');
  if (a.student_veteran) features.push('a student veteran group on campus');
  if (a.vet_tec_provider) features.push('VET TEC tech training');
  const feature = features.length > 0 ? ` Offers ${features.join(' and ')}.` : '';
  return `GI Bill-approved ${kind} school with dedicated veteran support. Use your Post-9/11 GI Bill and VA education benefits here.${feature} Confirm your program and remaining entitlement.`;
}

/** GI Bill institution → our `Resource`, or null if it isn't a usable school. */
function normalize(a: GiAttributes, today: string): NormalizedResource | null {
  const type = (a.type ?? '').toLowerCase();
  if (!SCHOOL_TYPES.has(type)) return null; // OJT / flight / foreign / correspondence
  if (a.online_only) return null; // no physical location to map
  const country = (a.physical_country ?? a.country ?? '').toUpperCase();
  if (country && country !== 'USA') return null;

  if (!isVeteranFocused(a)) return null; // general college that just accepts the benefit

  const externalId = trimOrNull(a.facility_code);
  const rawName = trimOrNull(a.name);
  if (!externalId || !rawName) return null;

  const zip = trimOrNull(a.physical_zip) ?? trimOrNull(a.zip);
  const street = trimOrNull(a.physical_address_1) ?? trimOrNull(a.address_1);
  const city = trimOrNull(a.physical_city) ?? trimOrNull(a.city);
  const state = trimOrNull(a.physical_state) ?? trimOrNull(a.state);
  if (!street && !city) return null; // nothing the geocoder or a veteran can use

  const address = [
    street,
    [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(', ');
  const website = normalizeUrl(a.insturl);

  return {
    id: `gibill:${externalId}`,
    name: titleCase(rawName),
    category: 'education',
    description: describe(a),
    address: address || null,
    // Coordinates come from the Census geocoder in the runner; unmatched stays null.
    latitude: null,
    longitude: null,
    geocode: { street, city, state, zip },
    phone: null,
    website,
    hours: null,
    eligibility:
      'Approved for the GI Bill and VA education benefits. Confirm your specific program is approved and check your remaining entitlement.',
    documents_needed: [],
    source_url: website,
    source_type: 'official',
    veteran_relevance: 'veteran_benefit',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: [
      'gi-bill',
      'school',
      type.replace(/\s+/g, '-'),
      ...(a.yr ? ['yellow-ribbon'] : []),
      ...(a.student_veteran ? ['student-veteran-group'] : []),
      ...(a.vet_tec_provider ? ['vet-tec'] : []),
    ],
    created_at: today,
    updated_at: today,
    external_id: externalId,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: a,
  };
}

// ---------------------------------------------------------------------------
// Enrichment: a phone number and a website, neither of which the search
// endpoint returns
// ---------------------------------------------------------------------------
//
// Before this, all 2,794 education rows had NO phone and NO website — the third
// data pass measured the category at **zero** usable rows, because a school you
// cannot ring or look up is not a resource. Two free sources fix it:
//
//  1. The GI Bill *detail* endpoint (`/institutions/{facility_code}`) returns 114
//     attributes where search returns 60. Among them is the school's **VA School
//     Certifying Official** — the person whose actual job is GI Bill paperwork.
//     That is a better number than a switchboard. Measured 2026-07-28: 25 of 25
//     sampled schools returned one.
//  2. College Scorecard supplies the website and real coordinates, joined on the
//     detail endpoint's `cross` field, which is the IPEDS UNITID.
//
// `insturl` is null for every record, so the website cannot come from VA.

/** Detail-endpoint fields we use; the response carries ~114 we don't. */
interface GiDetail {
  cross?: string | null;
  versioned_school_certifying_officials?:
    | {
        phone_area_code?: string | null;
        phone_number?: string | null;
        phone_extension?: string | null;
        priority?: string | null;
        title?: string | null;
      }[]
    | null;
}

interface Enrichment {
  phone: string | null;
  /** IPEDS UNITID, for the Scorecard join. */
  cross: string | null;
}

/**
 * The certifying official's number, preferring the one marked Primary.
 * Source formatting is inconsistent — `918` + `631-3985`, but also `856` +
 * `2252788` — so digits are reassembled rather than concatenated blindly.
 */
function certifyingOfficialPhone(detail: GiDetail): string | null {
  const officials = detail.versioned_school_certifying_officials ?? [];
  const ordered = [...officials].sort((a, b) => {
    const ap = /primary/i.test(a.priority ?? '') ? 0 : 1;
    const bp = /primary/i.test(b.priority ?? '') ? 0 : 1;
    return ap - bp;
  });
  for (const o of ordered) {
    const digits = `${o.phone_area_code ?? ''}${o.phone_number ?? ''}`.replace(/\D/g, '');
    if (digits.length !== 10) continue;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return null;
}

/** Fetch detail for every school, at the same concurrency the paging uses. */
async function fetchEnrichment(baseUrl: string, codes: string[]): Promise<Map<string, Enrichment>> {
  // The detail endpoint lives next to the search endpoint:
  // .../v0/gi/institutions/search → .../v0/gi/institutions/{code}
  const detailBase = baseUrl.replace(/\/search$/, '');
  const out = new Map<string, Enrichment>();

  for (let i = 0; i < codes.length; i += CONCURRENCY) {
    const batch = codes.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (code) => {
        try {
          const body = await fetchJson<{ data?: { attributes?: GiDetail } }>(
            `${detailBase}/${encodeURIComponent(code)}`,
            { label: 'GI Bill detail', timeoutMs: 30_000, maxRetries: 2 },
          );
          const attrs = body.data?.attributes ?? {};
          return [
            code,
            { phone: certifyingOfficialPhone(attrs), cross: trimOrNull(attrs.cross) },
          ] as const;
        } catch {
          // One school failing to enrich is not worth failing the run; it keeps
          // the address it already had.
          return [code, { phone: null, cross: null }] as const;
        }
      }),
    );
    for (const [code, enrichment] of results) out.set(code, enrichment);
    if (i > 0 && i % (CONCURRENCY * 40) === 0) {
      console.log(`[ingest] gi-bill: enriched ${i}/${codes.length} schools…`);
    }
  }
  return out;
}

interface ScorecardRow {
  id?: number | null;
  'school.school_url'?: string | null;
  'location.lat'?: number | null;
  'location.lon'?: number | null;
}

/**
 * College Scorecard by IPEDS id → website + coordinates. Needs a free
 * api.data.gov key; without one the API returns 403, so a missing key degrades
 * to "no website" rather than failing the run.
 */
async function fetchScorecard(
  apiKey: string | null,
  unitIds: string[],
): Promise<Map<string, { website: string | null; lat: number | null; lon: number | null }>> {
  const out = new Map<string, { website: string | null; lat: number | null; lon: number | null }>();
  if (!apiKey || unitIds.length === 0) return out;

  const PAGE = 100;
  for (let i = 0; i < unitIds.length; i += PAGE) {
    const ids = unitIds.slice(i, i + PAGE);
    const params = new URLSearchParams({
      id: ids.join(','),
      api_key: apiKey,
      per_page: String(PAGE),
      fields: 'id,school.school_url,location.lat,location.lon',
    });
    try {
      const body = await fetchJson<{ results?: ScorecardRow[] }>(
        `${SCORECARD_URL}?${params.toString()}`,
        { label: 'College Scorecard', timeoutMs: 60_000 },
      );
      for (const row of body.results ?? []) {
        if (row.id == null) continue;
        out.set(String(row.id), {
          website: normalizeUrl(row['school.school_url']),
          lat: typeof row['location.lat'] === 'number' ? row['location.lat'] : null,
          lon: typeof row['location.lon'] === 'number' ? row['location.lon'] : null,
        });
      }
    } catch (err) {
      console.warn(
        `[ingest] gi-bill: Scorecard page failed, continuing — ${String(err).slice(0, 90)}`,
      );
    }
  }
  return out;
}

function buildUrl(baseUrl: string, perPage: number, page: number): string {
  // `category=school` filters server-side to the ~13.8k schools (excludes the
  // ~19k OJT/employer rows). The API hard-caps per_page at 10, so this pages a lot.
  const params = new URLSearchParams({
    category: 'school',
    per_page: String(perPage),
    page: String(page),
  });
  return `${baseUrl}?${params.toString()}`;
}

async function fetchPage(url: string, maxRetries: number): Promise<GiResponse> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      // Retry rate limits and server errors; give up on other 4xx.
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        await sleep(Math.min(20_000, 500 * 2 ** attempt));
        continue;
      }
      if (!response.ok)
        throw new Error(`VA GI Bill API ${response.status}: ${await response.text()}`);
      return (await response.json()) as GiResponse;
    } catch (err) {
      // Network error / timeout / abort — transient over a long run; retry.
      if (attempt < maxRetries) {
        await sleep(Math.min(20_000, 500 * 2 ** attempt));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const createVaGiBillSchoolsSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const throttleMs = config.throttleMs ?? THROTTLE_MS;

  return {
    provider: PROVIDER,
    // Fetch the whole school list, keeping only mappable US schools. Page 1 gives
    // the total count; the rest are fetched in parallel chunks.
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const results: NormalizedResource[] = [];
      const seen = new Set<string>();

      const collect = (body: GiResponse): void => {
        for (const row of body.data ?? []) {
          if (!row.attributes) continue;
          const normalized = normalize(row.attributes, today);
          if (!normalized || seen.has(normalized.id)) continue;
          seen.add(normalized.id);
          results.push(normalized);
        }
      };

      const first = await fetchPage(buildUrl(config.baseUrl, query.perPage, 1), maxRetries);
      collect(first);
      const count = first.meta?.count ?? 0;
      const totalPages = Math.min(Math.max(Math.ceil(count / query.perPage), 1), query.maxPages);

      for (let start = 2; start <= totalPages; start += CONCURRENCY) {
        const pages: number[] = [];
        for (let p = start; p < start + CONCURRENCY && p <= totalPages; p++) pages.push(p);
        const bodies = await Promise.all(
          pages.map((p) => fetchPage(buildUrl(config.baseUrl, query.perPage, p), maxRetries)),
        );
        bodies.forEach(collect);
        if (throttleMs > 0) await sleep(throttleMs);
      }

      // --- Enrichment ---------------------------------------------------------
      // Without this every row ends with phone: null and website: null, which is
      // what made `education` measure zero usable rows.
      const codes = results.map((r) => r.external_id);
      console.log(
        `[ingest] gi-bill: fetching certifying-official contacts for ${codes.length} schools…`,
      );
      const enrichment = await fetchEnrichment(config.baseUrl, codes);

      const unitIds = [
        ...new Set([...enrichment.values()].map((e) => e.cross).filter((c): c is string => !!c)),
      ];
      const scorecard = await fetchScorecard(config.apiKey || null, unitIds);

      let withPhone = 0;
      let withWebsite = 0;
      let withCoords = 0;
      for (const row of results) {
        const extra = enrichment.get(row.external_id);
        if (extra?.phone) {
          row.phone = extra.phone;
          withPhone += 1;
        }
        const card = extra?.cross ? scorecard.get(extra.cross) : undefined;
        if (card?.website) {
          row.website = card.website;
          row.source_url = card.website;
          withWebsite += 1;
        }
        // Scorecard coordinates are the institution's own, so they beat a Census
        // geocode of the mailing address — take them and skip the geocoder.
        if (card?.lat != null && card?.lon != null) {
          row.latitude = card.lat;
          row.longitude = card.lon;
          delete row.geocode;
          withCoords += 1;
        }
      }

      console.log(
        `[ingest] gi-bill: ${withPhone}/${results.length} with a certifying-official phone, ` +
          `${withWebsite} with a website, ${withCoords} pre-geocoded` +
          (config.apiKey ? '' : ' (no DATA_GOV_API_KEY — websites and coordinates skipped)'),
      );
      return results;
    },
  };
};
