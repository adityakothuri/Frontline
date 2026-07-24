/**
 * HUD Housing Counseling adapter (data.hud.gov).
 *
 * Official, nationwide source of **HUD-approved housing counseling agencies** —
 * physical offices that give free help with renting, buying a home, avoiding
 * foreclosure, budgeting, and homelessness (including veterans navigating
 * HUD-VASH). Fills the `housing` category, our biggest gap.
 *
 * Base: https://data.hud.gov/Housing_Counselor. Auth: NONE — the endpoint is
 * public and keyless (the token-gated huduser.gov API is Fair Market Rent
 * reference data, a different thing). Endpoint:
 * GET /searchByLocation?Lat=&Long=&Distance= (miles). Response is a flat JSON
 * array of agencies; fields are lowercase provider keys (nme, adr1, phone1,
 * weburl, agc_ADDR_LATITUDE, services, counslg_METHOD, agcid).
 *
 * Because it's an official API, rows are `source_type: 'official'` /
 * `verification_status: 'verified'` with `last_checked` = fetch date. Field
 * shapes are verified against a live sample (via `--dry-run`) before any write.
 * The provider uses the string "N/A" as a null sentinel for weburl/email —
 * treated as null here so a real "no website" never shows a fake link.
 *
 * `veteran_relevance: 'general'` — open to everyone, not veteran-specific.
 * Backfills the housing category under the hybrid rule (2026-07-23): the UI
 * labels these "Open to everyone" and veteran rows always rank first.
 */
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'hud-housing-counseling';
const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_DISTANCE_MILES = 25;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** One agency as the HUD locator returns it (only the fields we read). */
interface HudAgency {
  agcid?: string | null;
  nme?: string | null;
  adr1?: string | null;
  adr2?: string | null;
  city?: string | null;
  statecd?: string | null;
  zipcd?: string | null;
  phone1?: string | null;
  weburl?: string | null;
  agc_ADDR_LATITUDE?: string | null;
  agc_ADDR_LONGITUDE?: string | null;
  /** Comma-joined HUD service codes, e.g. "PPC,DFC,RHC". */
  services?: string | null;
  /** Comma-joined counseling delivery methods, already plain English. */
  counslg_METHOD?: string | null;
}

/**
 * HUD service-code prefix → the plain-English thing a veteran gets help with.
 * The 3rd letter is the delivery (C = counseling, W = workshop); we key on the
 * 2-letter prefix so a code and its workshop variant collapse to one theme.
 * Codes we can't confidently decode contribute nothing — an honest, shorter
 * description beats a guessed one (same rule the VA adapter follows for hours).
 */
const SERVICE_THEME_BY_PREFIX: Record<string, string> = {
  PP: 'buying a home',
  DF: 'avoiding foreclosure',
  RH: 'renting',
  FB: 'budgeting and money management',
  RM: 'reverse mortgages',
  HI: 'home repairs',
  PL: 'avoiding loan scams',
  HM: 'help if you’re homeless or about to lose your housing',
};

// The order themes are listed in a description — most broadly useful first.
const THEME_ORDER = [
  'renting',
  'buying a home',
  'avoiding foreclosure',
  'help if you’re homeless or about to lose your housing',
  'budgeting and money management',
  'home repairs',
  'reverse mortgages',
  'avoiding loan scams',
];

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  // "N/A" is HUD's literal null sentinel for weburl/email — never a real value.
  return t && t.toUpperCase() !== 'N/A' ? t : null;
};

/** HUD gives coordinates as strings; parse and sanity-check, else null. */
function parseCoord(raw: string | null | undefined, kind: 'lat' | 'long'): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const limit = kind === 'lat' ? 90 : 180;
  if (n < -limit || n > limit) return null;
  if (n === 0) return null; // (0,0) is never a real agency address
  return n;
}

/** "www.example.org/" → "https://www.example.org"; "N/A"/blank → null. */
function normalizeUrl(raw: string | null | undefined): string | null {
  const v = trimOrNull(raw);
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return withScheme.replace(/\/+$/, '');
}

function buildAddress(a: HudAgency): string | null {
  const street = [a.adr1, a.adr2].map((s) => s?.trim()).filter(Boolean).join(' ');
  const region = [a.statecd?.trim(), a.zipcd?.trim()].filter(Boolean).join(' ');
  const cityRegion = [a.city?.trim(), region].filter(Boolean).join(', ');
  const full = [street, cityRegion].filter(Boolean).join(', ');
  return full.length > 0 ? full : null;
}

/** The distinct plain-English service themes this agency offers, ordered. */
function servicesToThemes(services: string | null | undefined): string[] {
  if (!services) return [];
  const themes = new Set<string>();
  for (const code of services.split(',')) {
    const theme = SERVICE_THEME_BY_PREFIX[code.trim().slice(0, 2).toUpperCase()];
    if (theme) themes.add(theme);
  }
  return THEME_ORDER.filter((t) => themes.has(t));
}

/** HUD's comma list of methods → "in person, by phone, and online" (or null). */
function counselingMethods(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const modes: string[] = [];
  if (lower.includes('face to face')) modes.push('in person');
  if (lower.includes('phone')) modes.push('by phone');
  if (lower.includes('internet') || lower.includes('video') || lower.includes('online')) {
    modes.push('online');
  }
  if (modes.length === 0) return null;
  if (modes.length === 1) return modes[0];
  return `${modes.slice(0, -1).join(', ')} and ${modes[modes.length - 1]}`;
}

/** Plain-English card description for a HUD housing counseling agency. */
function describe(agency: HudAgency): string {
  const themes = servicesToThemes(agency.services);
  const help =
    themes.length === 0
      ? 'housing questions'
      : themes.length === 1
        ? themes[0]
        : `${themes.slice(0, -1).join(', ')}, and ${themes[themes.length - 1]}`;
  const methods = counselingMethods(agency.counslg_METHOD);
  const how = methods ? ` Counseling is available ${methods}.` : '';
  return `HUD-approved housing counseling agency — free, expert help with ${help}.${how}`;
}

/** HUD agency → our `Resource`, or null if it isn't a usable resource. */
function normalize(agency: HudAgency, today: string): NormalizedResource | null {
  const externalId = trimOrNull(agency.agcid);
  const name = trimOrNull(agency.nme);
  if (!externalId || !name) return null;

  const website = normalizeUrl(agency.weburl);

  return {
    id: `hud:${externalId}`,
    name,
    category: 'housing',
    description: describe(agency),
    address: buildAddress(agency),
    latitude: parseCoord(agency.agc_ADDR_LATITUDE, 'lat'),
    longitude: parseCoord(agency.agc_ADDR_LONGITUDE, 'long'),
    phone: trimOrNull(agency.phone1),
    website,
    hours: null, // the locator doesn't return hours — honest unknown
    eligibility:
      'Open to everyone and free of charge. Veterans can ask about VA housing programs like HUD-VASH.',
    documents_needed: [],
    source_url: website,
    source_type: 'official',
    veteran_relevance: 'general',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['hud-approved', 'housing-counseling'],
    created_at: today,
    updated_at: today,
    external_id: externalId,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: agency,
  };
}

function buildUrl(baseUrl: string, query: IngestionQuery): string {
  if (typeof query.lat !== 'number' || typeof query.long !== 'number') {
    throw new Error('HUD housing counseling needs a location: pass --lat and --long (with optional --radius).');
  }
  const params = new URLSearchParams({
    Lat: String(query.lat),
    Long: String(query.long),
    Distance: String(query.radiusMiles ?? DEFAULT_DISTANCE_MILES),
  });
  return `${baseUrl.replace(/\/$/, '')}/searchByLocation?${params.toString()}`;
}

/** Fetch the agency list, retrying on HTTP 429 with exponential backoff. */
async function fetchAgencies(url: string, maxRetries: number): Promise<HudAgency[]> {
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
      console.warn(`[ingest] hud 429 — backing off ${Math.round(backoffMs / 1000)}s (retry ${attempt + 1}/${maxRetries})`);
      await sleep(backoffMs);
      continue;
    }
    if (!response.ok) {
      throw new Error(`HUD Housing Counselor API ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as HudAgency[] | { error?: unknown };
    return Array.isArray(body) ? body : [];
  }
}

export const createHudCounselingSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const agencies = await fetchAgencies(buildUrl(config.baseUrl, query), maxRetries);

      const results: NormalizedResource[] = [];
      const seen = new Set<string>(); // one office can list several branches near a point
      for (const agency of agencies) {
        const normalized = normalize(agency, today);
        if (!normalized || seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        results.push(normalized);
      }
      return results;
    },
  };
};
