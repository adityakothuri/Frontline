/**
 * HRSA Health Center adapter (data.hrsa.gov).
 *
 * Official, nationwide source of **HRSA-funded community health centers** —
 * sliding-fee primary care that serves everyone, including the uninsured and
 * low-income. Complements VA-only health with civilian safety-net clinics.
 * Fills the `healthcare` category with national coverage so any ZIP works.
 *
 * Source: the HRSA Data Warehouse's public **national CSV** of service-delivery
 * sites (data.hrsa.gov/DataDownload). Auth: NONE — the file is public and
 * keyless (the data.hrsa.gov JSON API redirects to an error page, so the
 * download is the reliable path). It's a single ~14 MB national file, not a geo
 * query, so this source is inherently nationwide: it ignores lat/long and loads
 * every active site. The app then does ZIP-radius filtering via `search_resources`.
 *
 * Official → `source_type: 'official'` / `verification_status: 'verified'`,
 * `last_checked` = fetch date. Column shapes are verified against the live file
 * (via `--dry-run`) before any write. Only rows with a valid geocode and an
 * "Active" status are kept — honest coverage over padded counts.
 */
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'hrsa-health-centers';
const REQUEST_TIMEOUT_MS = 60_000; // a ~14 MB national file

// Columns we read, by their exact header name (resolved to indices at runtime,
// so a reordered file doesn't silently misread — safer than magic numbers).
const COL = {
  bphc: 'BPHC Assigned Number',
  healthCenterNumber: 'Health Center Number',
  locationId: 'Health Center Location Identification Number',
  name: 'Site Name',
  address: 'Site Address',
  city: 'Site City',
  state: 'Site State Abbreviation',
  zip: 'Site Postal Code',
  phone: 'Site Telephone Number',
  website: 'Site Web Address',
  status: 'Site Status Description',
  longitude: 'Geocoding Artifact Address Primary X Coordinate',
  latitude: 'Geocoding Artifact Address Primary Y Coordinate',
} as const;

/**
 * Parse RFC-4180 CSV text into rows of fields, honoring quoted fields that may
 * contain commas, escaped quotes (""), and embedded newlines. HRSA site names
 * and addresses contain commas, so a naive line/`split(',')` would corrupt rows.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

/** "www.example.org/" → "https://www.example.org"; blank → null. */
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
  if (n === 0) return null; // (0,0) is never a real clinic
  return n;
}

function buildAddress(get: (col: string) => string): string | null {
  const region = [get(COL.state).trim(), get(COL.zip).trim()].filter(Boolean).join(' ');
  const cityRegion = [get(COL.city).trim(), region].filter(Boolean).join(', ');
  const full = [get(COL.address).trim(), cityRegion].filter(Boolean).join(', ');
  return full.length > 0 ? full : null;
}

/** One CSV row → our `Resource`, or null if inactive / unusable. */
function normalizeRow(get: (col: string) => string, today: string): NormalizedResource | null {
  if (get(COL.status).trim().toLowerCase() !== 'active') return null;

  const name = trimOrNull(get(COL.name));
  if (!name) return null;

  const latitude = parseCoord(get(COL.latitude), 'lat');
  const longitude = parseCoord(get(COL.longitude), 'long');
  if (latitude === null || longitude === null) return null; // a mapped clinic needs coords

  // Site-unique id: the BPHC assigned number, else the health-center + location pair.
  const externalId =
    trimOrNull(get(COL.bphc)) ??
    `${get(COL.healthCenterNumber).trim()}-${get(COL.locationId).trim()}`;
  if (!externalId || externalId === '-') return null;

  const website = normalizeUrl(get(COL.website));

  return {
    id: `hrsa:${externalId}`,
    name,
    category: 'healthcare',
    description:
      'HRSA-funded community health center offering affordable primary care — including checkups, sick visits, and often dental, mental health, and prescriptions — on a sliding fee scale.',
    address: buildAddress(get),
    latitude,
    longitude,
    phone: trimOrNull(get(COL.phone)),
    website,
    hours: null, // the file gives hours-per-week, not a daily schedule — honest unknown
    eligibility:
      'Open to everyone, including people who are uninsured. Fees slide based on your income — ask about the sliding fee scale.',
    documents_needed: [],
    source_url: website,
    source_type: 'official',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['hrsa', 'community-health-center', 'sliding-scale'],
    created_at: today,
    updated_at: today,
    external_id: externalId,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: null, // one flat CSV row — the normalized fields are the record
  };
}

async function downloadCsv(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // HRSA's server 406s on a specific `text/csv` Accept; it wants a wildcard.
    const response = await fetch(url, { headers: { accept: '*/*' }, signal: controller.signal });
    if (!response.ok) throw new Error(`HRSA CSV download ${response.status}: ${await response.text()}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export const createHrsaHealthCentersSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  return {
    provider: PROVIDER,
    // National file: geo params are ignored — every active site is loaded, and
    // the app filters by ZIP radius. That's what makes any ZIP work.
    async fetch(_query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const rows = parseCsv(await downloadCsv(config.baseUrl));
      if (rows.length < 2) return [];

      const header = rows[0].map((h) => h.trim());
      const index: Record<string, number> = {};
      for (const col of Object.values(COL)) {
        const i = header.indexOf(col);
        if (i === -1) throw new Error(`HRSA CSV missing expected column "${col}" — the file format changed.`);
        index[col] = i;
      }

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        const get = (col: string): string => cells[index[col]] ?? '';
        const normalized = normalizeRow(get, today);
        if (!normalized || seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        results.push(normalized);
      }
      return results;
    },
  };
};
