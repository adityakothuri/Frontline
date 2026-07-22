/**
 * LSC Legal Aid adapter (Legal Services Corporation, via ArcGIS).
 *
 * Official, nationwide source of **free civil legal-aid offices** — the ~130
 * LSC-funded nonprofits (plus their branch offices) that help low-income people
 * with civil matters like eviction, benefits, family, and consumer problems.
 * Fills the `legal` category. LSC is a federally-funded nonprofit; this is the
 * authoritative national directory.
 *
 * Source: LSC's public ArcGIS Feature Service
 * `LSC_offices_grantees_main_branch (Public)` (owner `laytonj_LSCGOV`). Auth:
 * NONE (public feature server). This is the first ArcGIS-backed adapter, so it
 * uses the ArcGIS query protocol: GET {layer}/query?where=1=1&outFields=*&
 * resultOffset=&resultRecordCount=&f=json, paging on `exceededTransferLimit`.
 * Each feature has `attributes` (incl. Latitude/Longitude) + point `geometry`.
 *
 * Official → `source_type: 'official'` / `verification_status: 'verified'`,
 * `last_checked` = fetch date. The directory has no phone/website columns, so
 * those are honestly null (address + directions still work). Shapes verified
 * against a live sample (via `--dry-run`) before any write.
 */
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'lsc-legal-aid';
const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 3;
const PAGE_SIZE = 1000; // ArcGIS maxRecordCount; the whole set (~860) fits in ~1 page

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface LscAttributes {
  recipOffID?: string | number | null;
  officenam?: string | null;
  officetype?: string | null; // "Main" | "Branch"
  orgName?: string | null;
  address?: string | null;
  bldgSuite?: string | null;
  City?: string | null;
  State?: string | null;
  ZIP?: string | null;
  Latitude?: number | null;
  Longitude?: number | null;
}

interface LscFeature {
  attributes?: LscAttributes;
}

interface LscResponse {
  features?: LscFeature[];
  exceededTransferLimit?: boolean;
  error?: { message?: string };
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

function isSaneCoord(lat: number | null | undefined, long: number | null | undefined): boolean {
  if (typeof lat !== 'number' || typeof long !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(long)) return false;
  if (lat < -90 || lat > 90 || long < -180 || long > 180) return false;
  return lat !== 0 || long !== 0;
}

function buildAddress(a: LscAttributes): string | null {
  const street = [a.address?.trim(), a.bldgSuite?.trim()].filter((s) => s && s !== '').join(' ');
  const region = [a.State?.trim(), a.ZIP?.trim()].filter(Boolean).join(' ');
  const cityRegion = [a.City?.trim(), region].filter(Boolean).join(', ');
  const full = [street, cityRegion].filter(Boolean).join(', ');
  return full.length > 0 ? full : null;
}

/** LSC office → our `Resource`, or null if unusable. */
function normalize(attrs: LscAttributes, today: string): NormalizedResource | null {
  const org = trimOrNull(attrs.orgName);
  const office = trimOrNull(attrs.officenam);
  const name = org ?? office;
  if (!name) return null;
  if (!isSaneCoord(attrs.Latitude, attrs.Longitude)) return null;

  const externalId = trimOrNull(String(attrs.recipOffID ?? ''));
  if (!externalId) return null;

  // Distinguish a branch office from the main org so the list isn't ambiguous.
  const isBranch = (attrs.officetype ?? '').toLowerCase() === 'branch';
  const displayName = isBranch && office && org && office !== org ? `${org} — ${office}` : name;

  return {
    id: `lsc:${externalId}`,
    name: displayName,
    category: 'legal',
    description:
      'Free civil legal aid from an LSC-funded nonprofit — help with things like eviction, housing, public benefits, family, and consumer problems (civil, not criminal). Income eligibility applies.',
    address: buildAddress(attrs),
    latitude: attrs.Latitude as number,
    longitude: attrs.Longitude as number,
    phone: null, // not in the directory — honest null
    website: null,
    hours: null,
    eligibility:
      'Free for people with low income who qualify. Call to check eligibility and what to bring. Civil (non-criminal) matters only.',
    documents_needed: [],
    source_url: null,
    source_type: 'official',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['legal-aid', 'lsc-funded', isBranch ? 'branch-office' : 'main-office'],
    created_at: today,
    updated_at: today,
    external_id: externalId,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: attrs,
  };
}

function buildUrl(baseUrl: string, offset: number): string {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: 'recipOffID,officenam,officetype,orgName,address,bldgSuite,City,State,ZIP,Latitude,Longitude',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    f: 'json',
  });
  return `${baseUrl.replace(/\/$/, '')}/query?${params.toString()}`;
}

async function fetchPage(url: string, maxRetries: number): Promise<LscResponse> {
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
      console.warn(`[ingest] lsc 429 — backing off ${Math.round(backoffMs / 1000)}s`);
      await sleep(backoffMs);
      continue;
    }
    if (!response.ok) {
      throw new Error(`LSC ArcGIS ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as LscResponse;
    // ArcGIS returns HTTP 200 with an { error } body on query problems.
    if (body.error) throw new Error(`LSC ArcGIS error: ${body.error.message ?? 'unknown'}`);
    return body;
  }
}

export const createLscLegalAidSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

  return {
    provider: PROVIDER,
    // National directory: page through everything; the app filters by ZIP.
    async fetch(_query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const results: NormalizedResource[] = [];
      const seen = new Set<string>();

      for (let offset = 0; ; offset += PAGE_SIZE) {
        const body = await fetchPage(buildUrl(config.baseUrl, offset), maxRetries);
        const features = body.features ?? [];
        for (const feature of features) {
          if (!feature.attributes) continue;
          const normalized = normalize(feature.attributes, today);
          if (!normalized || seen.has(normalized.id)) continue;
          seen.add(normalized.id);
          results.push(normalized);
        }
        if (!body.exceededTransferLimit || features.length === 0) break;
      }
      return results;
    },
  };
};
