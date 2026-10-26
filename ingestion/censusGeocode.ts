/**
 * Exact-address geocoding for ingestion, via the free US Census batch geocoder.
 *
 * For sources that give street addresses but no coordinates, pins must sit on the
 * real building or not exist at all — never an approximation. This module
 * resolves `geocode` address parts to coordinates:
 *
 *   1. Read the `geocode_cache` table (service role) — hits and known misses.
 *   2. Chunk uncached addresses into <=10,000-row CSV batches and POST them to
 *      `geocoding.geo.census.gov/geocoder/locations/addressbatch` (keyless).
 *   3. Cache every result — misses too (matched=false), so a bad address is
 *      never re-submitted on the next run.
 *
 * Only a Census "Match" yields coordinates; "No_Match" and ambiguous "Tie"
 * results stay null — the resource is still listed, just not pinned.
 */
import { sleep } from './lib/http.ts';
import type { AdminConfig } from './upsert.ts';
import type { AddressParts, NormalizedResource } from './types.ts';

const CENSUS_BATCH_URL = 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch';
// Census allows up to 10k per request, but big batches routinely stall/drop on
// their end; 2.5k returns in a few minutes reliably. Results are cached per
// batch, so an interrupted run resumes where it left off.
const BATCH_SIZE = 2_500;
const BATCH_TIMEOUT_MS = 20 * 60_000;
const BATCH_RETRIES = 5;
const BATCH_RETRY_DELAY_MS = 45_000; // Census 502s in waves; give it a real pause
const CACHE_PAGE = 1_000; // PostgREST max_rows caps responses at 1000 regardless of Range
const CACHE_WRITE_BATCH = 500;

interface CacheRow {
  address_key: string;
  latitude: number | null;
  longitude: number | null;
  matched: boolean;
  geocoded_at?: string;
}

/** Normalized cache key: upper-cased, whitespace-collapsed street|city|state|zip5. */
export function addressKey(parts: AddressParts): string {
  const norm = (s: string | null): string => (s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  return [
    norm(parts.street),
    norm(parts.city),
    norm(parts.state),
    norm(parts.zip).slice(0, 5),
  ].join('|');
}

/** A CSV field for the Census input file (always quoted; quotes doubled, newlines stripped). */
const csvField = (s: string | null): string =>
  `"${(s ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`;

/** Minimal parser for one quoted-CSV line of the Census result file. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

async function readCache(admin: AdminConfig): Promise<Map<string, CacheRow>> {
  const cache = new Map<string, CacheRow>();
  // Advance by what actually came back and stop only on an empty page — the
  // server may return fewer rows than asked (max_rows), and trusting the ask
  // would silently truncate the cache and re-geocode thousands of addresses.
  for (let offset = 0; ;) {
    const response = await fetch(
      `${admin.url}/rest/v1/geocode_cache?select=address_key,latitude,longitude,matched&order=address_key`,
      {
        headers: {
          apikey: admin.serviceKey,
          Authorization: `Bearer ${admin.serviceKey}`,
          Range: `${offset}-${offset + CACHE_PAGE - 1}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`geocode_cache read: HTTP ${response.status} — ${await response.text()}`);
    }
    const rows = (await response.json()) as CacheRow[];
    for (const row of rows) cache.set(row.address_key, row);
    if (rows.length === 0) return cache;
    offset += rows.length;
  }
}

async function writeCache(admin: AdminConfig, rows: CacheRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CACHE_WRITE_BATCH) {
    const batch = rows.slice(i, i + CACHE_WRITE_BATCH);
    const response = await fetch(`${admin.url}/rest/v1/geocode_cache?on_conflict=address_key`, {
      method: 'POST',
      headers: {
        apikey: admin.serviceKey,
        Authorization: `Bearer ${admin.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });
    if (!response.ok) {
      throw new Error(`geocode_cache write: HTTP ${response.status} — ${await response.text()}`);
    }
  }
}

/** One Census batch: CSV of `id,street,city,state,zip` in → key→coords|null out. */
async function censusBatch(
  entries: { key: string; parts: AddressParts }[],
): Promise<Map<string, { latitude: number; longitude: number } | null>> {
  const csv = entries
    .map((e, i) =>
      [
        String(i),
        csvField(e.parts.street),
        csvField(e.parts.city),
        csvField(e.parts.state),
        csvField(e.parts.zip),
      ].join(','),
    )
    .join('\n');

  const form = new FormData();
  form.append('addressFile', new Blob([csv], { type: 'text/csv' }), 'addresses.csv');
  form.append('benchmark', 'Public_AR_Current');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BATCH_TIMEOUT_MS);
  try {
    const response = await fetch(CENSUS_BATCH_URL, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Census geocoder: HTTP ${response.status} — ${await response.text()}`);
    }
    const text = await response.text();

    const results = new Map<string, { latitude: number; longitude: number } | null>();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      // "row id","input address","Match|No_Match|Tie","Exact|Non_Exact","matched address","lng,lat",...
      const fields = parseCsvLine(line);
      const entry = entries[Number(fields[0])];
      if (!entry) continue;
      if (fields[2] !== 'Match') {
        results.set(entry.key, null);
        continue;
      }
      const [lng, lat] = (fields[5] ?? '').split(',').map(Number);
      const sane =
        Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      results.set(entry.key, sane ? { latitude: lat, longitude: lng } : null);
    }
    // Rows the response omitted entirely count as misses, not retries.
    for (const e of entries) if (!results.has(e.key)) results.set(e.key, null);
    return results;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve coordinates for every item carrying `geocode` address parts, in
 * place. Cache-first; only uncached addresses go to the Census. Unmatched
 * addresses keep null coordinates — listed but never pinned.
 */
export async function geocodeResources(
  admin: AdminConfig,
  items: NormalizedResource[],
): Promise<{ matched: number; unmatched: number; fromCache: number }> {
  const pending = items.filter((item) => item.geocode);
  if (pending.length === 0) return { matched: 0, unmatched: 0, fromCache: 0 };

  const cache = await readCache(admin);
  const today = new Date().toISOString().slice(0, 10);

  // Unique uncached addresses, keyed so duplicate addresses geocode once.
  const uncached = new Map<string, AddressParts>();
  for (const item of pending) {
    const key = addressKey(item.geocode as AddressParts);
    if (!cache.has(key)) uncached.set(key, item.geocode as AddressParts);
  }
  const fromCache = pending.length - uncached.size;

  const entries = [...uncached.entries()].map(([key, parts]) => ({ key, parts }));
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    console.log(
      `[geocode] Census batch ${i / BATCH_SIZE + 1}/${Math.ceil(entries.length / BATCH_SIZE)} (${chunk.length} addresses)…`,
    );
    let results: Map<string, { latitude: number; longitude: number } | null> | null = null;
    for (let attempt = 0; results === null; attempt++) {
      try {
        results = await censusBatch(chunk);
      } catch (err) {
        if (attempt >= BATCH_RETRIES) throw err;
        console.warn(
          `[geocode] batch failed (${String(err).slice(0, 200)}) — retrying in ${BATCH_RETRY_DELAY_MS / 1000}s`,
        );
        await sleep(BATCH_RETRY_DELAY_MS);
      }
    }
    const cacheRows: CacheRow[] = [];
    for (const [key, coords] of results) {
      const row: CacheRow = {
        address_key: key,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        matched: coords !== null,
        geocoded_at: today,
      };
      cache.set(key, row);
      cacheRows.push(row);
    }
    await writeCache(admin, cacheRows);
  }

  let matched = 0;
  let unmatched = 0;
  for (const item of pending) {
    const hit = cache.get(addressKey(item.geocode as AddressParts));
    if (hit?.matched && hit.latitude !== null && hit.longitude !== null) {
      item.latitude = hit.latitude;
      item.longitude = hit.longitude;
      matched++;
    } else {
      item.latitude = null;
      item.longitude = null;
      unmatched++;
    }
  }
  return { matched, unmatched, fromCache };
}
