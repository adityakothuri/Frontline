/**
 * SAMHSA FindTreatment.gov adapter (findtreatment.gov).
 *
 * Official, nationwide source of **mental health & substance-use treatment**
 * facilities — a high area of veteran need. Fills the `healthcare` category with
 * treatment providers that VA and HRSA don't cover (opioid treatment programs,
 * mental-health clinics, addiction treatment).
 *
 * Endpoint: GET /locator/exportsAsJson/v2?pageSize=&page= — called with NO geo
 * limit, which returns the entire national dataset paginated (verified:
 * ~45k records). Auth: NONE (public, keyless). The response nests facilities in
 * `rows[]` with `totalPages` for paging.
 *
 * Two things the live data forces us to handle:
 *  1. The national export mixes in `typeFacility: "HRSA"` rows — the same health
 *     centers the HRSA adapter already ingests (with better fields). We keep only
 *     genuine treatment facilities (SA / MH / OTP) so the two sources don't
 *     duplicate each other.
 *  2. The national export returns an empty `services[]` for almost every row, so
 *     the plain-English description is derived from `typeFacility`, not services.
 *
 * Records carry no stable provider id, so a deterministic key is synthesized
 * from name + address (stable across runs for idempotent upserts). Official →
 * `source_type: 'official'` / `verification_status: 'verified'`. Copy is
 * deliberately non-stigmatizing.
 */
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'samhsa-findtreatment';
const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const THROTTLE_MS = 300;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** typeFacility codes we ingest → plain-English facility description. Any code
 *  not listed here (notably "HRSA") is skipped: HRSA has its own adapter. */
const TREATMENT_TYPES: Record<string, string> = {
  SA: 'Substance use and addiction treatment facility offering counseling and recovery support.',
  MH: 'Mental health treatment facility offering counseling and psychiatric care.',
  OTP: 'Opioid treatment program — medication-assisted treatment (such as methadone or buprenorphine) with counseling.',
};

interface SamhsaRow {
  name1?: string | null;
  name2?: string | null;
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  intake1?: string | null;
  website?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  typeFacility?: string | null;
}

interface SamhsaResponse {
  page?: number;
  totalPages?: number;
  recordCount?: number;
  rows?: SamhsaRow[];
}

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

function parseCoord(raw: string | null | undefined, kind: 'lat' | 'long'): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const limit = kind === 'lat' ? 90 : 180;
  if (n < -limit || n > limit) return null;
  if (n === 0) return null;
  return n;
}

function buildAddress(row: SamhsaRow): string | null {
  const street = [row.street1, row.street2].map((s) => s?.trim()).filter(Boolean).join(' ');
  const region = [row.state?.trim(), row.zip?.trim()].filter(Boolean).join(' ');
  const cityRegion = [row.city?.trim(), region].filter(Boolean).join(', ');
  const full = [street, cityRegion].filter(Boolean).join(', ');
  return full.length > 0 ? full : null;
}

/** Deterministic, stable id from identity fields (the API exposes no facility id). */
function syntheticId(row: SamhsaRow): string {
  return [row.name1, row.street1, row.city, row.state, row.zip]
    .map((s) => (s ?? '').trim().toLowerCase())
    .join('|')
    .replace(/[^a-z0-9|]+/g, '-')
    .replace(/\|/g, '_');
}

/** SAMHSA row → our `Resource`, or null if it isn't a treatment facility we keep. */
function normalize(row: SamhsaRow, today: string): NormalizedResource | null {
  const type = (row.typeFacility ?? '').trim().toUpperCase();
  const description = TREATMENT_TYPES[type];
  if (!description) return null; // HRSA rows and unknown types are skipped

  const name = trimOrNull(row.name1);
  if (!name) return null;

  const latitude = parseCoord(row.latitude, 'lat');
  const longitude = parseCoord(row.longitude, 'long');
  if (latitude === null || longitude === null) return null;

  const externalId = syntheticId(row);
  const website = normalizeUrl(row.website);
  const program = trimOrNull(row.name2); // e.g. "Behavioral Health" division

  return {
    id: `samhsa:${externalId}`,
    name: program ? `${name} — ${program}` : name,
    category: 'healthcare',
    description,
    address: buildAddress(row),
    latitude,
    longitude,
    phone: trimOrNull(row.phone) ?? trimOrNull(row.intake1),
    website,
    hours: null,
    eligibility:
      'Call to ask about eligibility, insurance, cost, and whether free or sliding-scale care is available. Confidential.',
    documents_needed: [],
    source_url: website,
    source_type: 'official',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['samhsa', 'treatment', type.toLowerCase()],
    created_at: today,
    updated_at: today,
    external_id: externalId,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: row,
  };
}

function buildUrl(baseUrl: string, perPage: number, page: number): string {
  const params = new URLSearchParams({ pageSize: String(perPage), page: String(page) });
  return `${baseUrl.replace(/\/$/, '')}?${params.toString()}`;
}

async function fetchPage(url: string, maxRetries: number): Promise<SamhsaResponse> {
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
      console.warn(`[ingest] samhsa 429 — backing off ${Math.round(backoffMs / 1000)}s`);
      await sleep(backoffMs);
      continue;
    }
    if (!response.ok) {
      throw new Error(`SAMHSA FindTreatment API ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as SamhsaResponse;
  }
}

export const createSamhsaTreatmentSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const throttleMs = config.throttleMs ?? THROTTLE_MS;

  return {
    provider: PROVIDER,
    // National paging (no geo limit) → every treatment facility; the app filters
    // by ZIP radius. `maxPages` caps the sweep (use a small value for a dry run).
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const results: NormalizedResource[] = [];
      const seen = new Set<string>();

      let totalPages = query.maxPages; // refined from the first response
      for (let page = 1; page <= Math.min(totalPages, query.maxPages); page++) {
        if (page > 1 && throttleMs > 0) await sleep(throttleMs);
        const body = await fetchPage(buildUrl(config.baseUrl, query.perPage, page), maxRetries);
        if (page === 1 && typeof body.totalPages === 'number') totalPages = body.totalPages;

        for (const row of body.rows ?? []) {
          const normalized = normalize(row, today);
          if (!normalized || seen.has(normalized.id)) continue;
          seen.add(normalized.id);
          results.push(normalized);
        }
        if ((body.rows ?? []).length < query.perPage) break; // last page
      }
      return results;
    },
  };
};
