/**
 * USAJOBS API adapter (developer.usajobs.gov).
 *
 * Official OPM source of **federal job openings** — relevant to veterans, who
 * get hiring preference for them. Base: https://data.usajobs.gov/api. Auth: two
 * headers — `Authorization-Key` (the API key) and `User-Agent` (the email the
 * key was registered with). Endpoint: GET /search?LocationName=&Radius=&Keyword=
 * &ResultsPerPage=&Page=. Response nests jobs under
 * `SearchResult.SearchResultItems[].MatchedObjectDescriptor`.
 *
 * Jobs are official → `source_type: 'official'` / `verification_status:
 * 'verified'`. Unlike facilities, postings **expire** (`ApplicationCloseDate`),
 * so this is a snapshot: the weekly `refresh.sh jobs` sweep re-ingests and purges
 * postings not seen in 21 days. Ingest is location-scoped (near a place), not a
 * blind nationwide dump, since postings churn.
 */
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'usajobs';
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const THROTTLE_MS = 300;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface UsaJobLocation {
  LocationName?: string | null;
  CityName?: string | null;
  CountrySubDivisionCode?: string | null;
  Latitude?: number | null;
  Longitude?: number | null;
}

interface UsaJobDescriptor {
  PositionID?: string | null;
  PositionTitle?: string | null;
  PositionURI?: string | null;
  ApplyURI?: string[] | null;
  OrganizationName?: string | null;
  DepartmentName?: string | null;
  PositionLocation?: UsaJobLocation[] | null;
  PositionRemuneration?:
    | { MinimumRange?: string | null; MaximumRange?: string | null; Description?: string | null }[]
    | null;
  PublicationStartDate?: string | null;
  ApplicationCloseDate?: string | null;
}

interface UsaJobsResponse {
  SearchResult?: {
    SearchResultItems?: { MatchedObjectDescriptor?: UsaJobDescriptor }[];
  };
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

const isRealCoord = (lat: number | null | undefined, long: number | null | undefined): boolean =>
  typeof lat === 'number' &&
  typeof long === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(long) &&
  lat >= -90 &&
  lat <= 90 &&
  long >= -180 &&
  long <= 180 &&
  (lat !== 0 || long !== 0); // (0,0) is USAJOBS' sentinel for remote/undisclosed

const isoDate = (raw: string | null | undefined, fallback: string): string => {
  const d = raw ? raw.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fallback;
};

/** "50420" → "$50,420"; blank/non-numeric → null. */
function money(raw: string | null | undefined): string | null {
  const n = Number(raw);
  return raw && Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : null;
}

function buildDescription(d: UsaJobDescriptor): string {
  const org = trimOrNull(d.OrganizationName) ?? trimOrNull(d.DepartmentName) ?? 'a federal agency';
  const pay = d.PositionRemuneration?.[0];
  const min = money(pay?.MinimumRange);
  const max = money(pay?.MaximumRange);
  const period = pay?.Description ? ` ${pay.Description.toLowerCase()}` : '';
  const salary = min && max ? ` Pay: ${min}–${max}${period}.` : '';
  return `Federal job opening at ${org}. Veterans may qualify for hiring preference.${salary}`;
}

/** USAJOBS posting → our `Resource`, or null if unusable. */
function normalize(d: UsaJobDescriptor, today: string): NormalizedResource | null {
  const externalId = trimOrNull(d.PositionID);
  const name = trimOrNull(d.PositionTitle);
  if (!externalId || !name) return null;

  // Prefer a location with real coordinates; fall back to the first listed.
  const locations = d.PositionLocation ?? [];
  const located = locations.find((l) => isRealCoord(l.Latitude, l.Longitude));
  const loc = located ?? locations[0];
  const hasCoords = Boolean(located);

  const applyUrl = trimOrNull(d.ApplyURI?.[0]) ?? trimOrNull(d.PositionURI);

  return {
    id: `usajobs:${externalId}`,
    name,
    category: 'jobs',
    description: buildDescription(d),
    address: trimOrNull(loc?.LocationName),
    latitude: hasCoords ? (located!.Latitude as number) : null,
    longitude: hasCoords ? (located!.Longitude as number) : null,
    phone: null,
    website: applyUrl,
    hours: null,
    eligibility:
      'Open to applicants per the posting. Veterans may be eligible for veterans’ preference — check the listing.',
    documents_needed: ['resume'],
    source_url: applyUrl,
    source_type: 'official',
    veteran_relevance: 'veteran_benefit', // federal jobs carry veterans' hiring preference
    verification_status: 'verified',
    last_checked: today,
    last_updated: isoDate(d.PublicationStartDate, today),
    tags: ['federal-job', 'veterans-preference'],
    created_at: today,
    updated_at: today,
    external_id: externalId,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: d,
  };
}

function buildUrl(baseUrl: string, query: IngestionQuery, page: number): string {
  const params = new URLSearchParams({ ResultsPerPage: String(query.perPage), Page: String(page) });
  if (query.locationName) params.set('LocationName', query.locationName);
  if (typeof query.radiusMiles === 'number') params.set('Radius', String(query.radiusMiles));
  if (query.keyword) params.set('Keyword', query.keyword);
  return `${baseUrl.replace(/\/$/, '')}/search?${params.toString()}`;
}

async function fetchPage(
  url: string,
  apiKey: string,
  userAgent: string,
  maxRetries: number,
): Promise<UsaJobDescriptor[]> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'Authorization-Key': apiKey, 'User-Agent': userAgent, accept: 'application/json' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429 && attempt < maxRetries) {
      const backoffMs = Math.min(30_000, 1000 * 2 ** attempt);
      console.warn(`[ingest] usajobs 429 — backing off ${Math.round(backoffMs / 1000)}s`);
      await sleep(backoffMs);
      continue;
    }
    if (!response.ok) {
      throw new Error(`USAJOBS API ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as UsaJobsResponse;
    return (body.SearchResult?.SearchResultItems ?? [])
      .map((item) => item.MatchedObjectDescriptor)
      .filter((d): d is UsaJobDescriptor => Boolean(d));
  }
}

export const createUsaJobsSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  const userAgent = config.userAgent;
  if (!userAgent) throw new Error('USAJOBS needs USAJOBS_USER_AGENT (the email the key is registered to).');
  const throttleMs = config.throttleMs ?? THROTTLE_MS;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const results: NormalizedResource[] = [];
      const seenId = new Set<string>();
      const seenPosting = new Set<string>(); // collapse re-announced dup postings

      for (let page = 1; page <= query.maxPages; page++) {
        if (page > 1 && throttleMs > 0) await sleep(throttleMs);
        const descriptors = await fetchPage(buildUrl(config.baseUrl, query, page), config.apiKey, userAgent, maxRetries);
        for (const d of descriptors) {
          const normalized = normalize(d, today);
          if (!normalized || seenId.has(normalized.id)) continue;
          // The same job is often posted under several announcement numbers;
          // collapse by title + org + location so the list isn't full of dupes.
          const postingKey = `${normalized.name}|${d.OrganizationName ?? ''}|${normalized.address ?? ''}`.toLowerCase();
          if (seenPosting.has(postingKey)) continue;
          seenId.add(normalized.id);
          seenPosting.add(postingKey);
          results.push(normalized);
        }
        if (descriptors.length < query.perPage) break; // last page
      }
      return results;
    },
  };
};
