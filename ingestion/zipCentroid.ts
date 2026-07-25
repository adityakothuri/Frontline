/**
 * ZIP-centroid lookup for ingestion — approximate a US location from a 5-digit
 * ZIP using the Census ZCTA centroids in the repo
 * (`supabase/seed-data/zcta_centroids.csv`, the same 33k rows in the
 * `zip_centroids` table).
 *
 * Use ONLY for sources whose finest available location is a ZIP (no street
 * address to geocode exactly) — e.g. VA-accredited VSO representatives, listed
 * by city/state/zip. This is the honest best for that data: it places them in
 * the right town so radius search works, and the resource is call-first anyway.
 * Sources that DO have street addresses must use the Census geocoder
 * (`censusGeocode.ts`) instead — never approximate when exact is available.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

let cache: Map<string, Coordinates> | null = null;

function load(): Map<string, Coordinates> {
  if (cache) return cache;
  const root = resolve(import.meta.dirname, '..');
  const raw = readFileSync(resolve(root, 'supabase/seed-data/zcta_centroids.csv'), 'utf8');
  const map = new Map<string, Coordinates>();
  for (const line of raw.split('\n').slice(1)) {
    const [zip, lat, lng] = line.split(',');
    if (!zip) continue;
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      map.set(zip.trim(), { latitude, longitude });
    }
  }
  cache = map;
  return map;
}

/** Census ZCTA centroid for a US ZIP, or null if it isn't a known 5-digit ZCTA. */
export function zipCentroid(zip: string | null | undefined): Coordinates | null {
  const z = (zip ?? '').trim().slice(0, 5);
  if (!/^\d{5}$/.test(z)) return null;
  return load().get(z) ?? null;
}
