/**
 * VA GI Bill schools adapter (GI Bill Comparison Tool API).
 *
 * Veteran-relevant by construction: only schools **approved for the GI Bill /
 * VA education benefits** — so a veteran can actually use their benefits there
 * (this is what replaced the generic "every college" dataset). `veteran_benefit`.
 *
 * Source: the keyless VA GI Bill Comparison Tool institutions API,
 * `https://api.va.gov/v0/gi/institutions/search?per_page=&page=` (JSON:API,
 * `data[].attributes`). It lists ~33k approved institutions; we keep the ones
 * that are actual schools (`type` public / private / for profit), US-based, and
 * not online-only — excluding OJT (~19k), flight, foreign, and correspondence.
 * The list has full street addresses but **no coordinates** (and no phone; the
 * `insturl` website field is often absent from the current payload). Rows are
 * emitted with null coords + `geocode` address parts; the runner resolves them
 * to exact coordinates via the Census batch geocoder, and addresses that don't
 * match stay null — listed, never pinned at an approximate spot.
 *
 * Official → `source_type:'official'` / `verification_status:'verified'`.
 * Shapes verified against a live sample (via `--dry-run`) before any write.
 */
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
  yr?: boolean | null; // Yellow Ribbon program
  insturl?: string | null;
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
  const kind =
    a.type === 'public' ? 'public' : a.type === 'private' ? 'private nonprofit' : 'private for-profit';
  const yr = a.yr ? ' Offers the Yellow Ribbon program (extra tuition coverage).' : '';
  return `GI Bill-approved ${kind} school. You can use your Post-9/11 GI Bill and VA education benefits here.${yr} Confirm your program and remaining entitlement.`;
}

/** GI Bill institution → our `Resource`, or null if it isn't a usable school. */
function normalize(a: GiAttributes, today: string): NormalizedResource | null {
  const type = (a.type ?? '').toLowerCase();
  if (!SCHOOL_TYPES.has(type)) return null; // OJT / flight / foreign / correspondence
  if (a.online_only) return null; // no physical location to map
  const country = (a.physical_country ?? a.country ?? '').toUpperCase();
  if (country && country !== 'USA') return null;

  const externalId = trimOrNull(a.facility_code);
  const rawName = trimOrNull(a.name);
  if (!externalId || !rawName) return null;

  const zip = trimOrNull(a.physical_zip) ?? trimOrNull(a.zip);
  const street = trimOrNull(a.physical_address_1) ?? trimOrNull(a.address_1);
  const city = trimOrNull(a.physical_city) ?? trimOrNull(a.city);
  const state = trimOrNull(a.physical_state) ?? trimOrNull(a.state);
  if (!street && !city) return null; // nothing the geocoder or a veteran can use

  const address = [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
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
    tags: ['gi-bill', 'school', type.replace(/\s+/g, '-'), ...(a.yr ? ['yellow-ribbon'] : [])],
    created_at: today,
    updated_at: today,
    external_id: externalId,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: a,
  };
}

function buildUrl(baseUrl: string, perPage: number, page: number): string {
  // `category=school` filters server-side to the ~13.8k schools (excludes the
  // ~19k OJT/employer rows). The API hard-caps per_page at 10, so this pages a lot.
  const params = new URLSearchParams({ category: 'school', per_page: String(perPage), page: String(page) });
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
      if (!response.ok) throw new Error(`VA GI Bill API ${response.status}: ${await response.text()}`);
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

export const createVaGiBillSchoolsSource: SourceFactory = (config: SourceConfig): IngestionSource => {
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
      return results;
    },
  };
};
