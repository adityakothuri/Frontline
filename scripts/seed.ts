/**
 * Frontline Phase 10 seed script — upserts the Census ZCTA zip centroids into
 * Supabase via PostgREST. Real REFERENCE data only (used to turn a ZIP into a
 * lat/long for radius search).
 *
 * Run (Node >= 22):  node --experimental-strip-types scripts/seed.ts
 * Requires env:      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *                    (shell env or a git-ignored .env.seed — never EXPO_PUBLIC_*)
 *
 * Resources are NOT seeded here — they come exclusively from the real ingestion
 * pipeline (`ingestion/run.ts`: VA Facilities, GI Bill, USAJOBS, HUD, SSVF,
 * VSO reps, Feeding America, and a curated national list). There is no
 * simulated resource data anywhere.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from '../ingestion/lib/env.ts';

const root = resolve(import.meta.dirname, '..');

loadEnvFile(resolve(root, '.env.seed'));
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (shell env or .env.seed).');
  process.exit(1);
}

async function upsert(table: string, conflictKey: string, rows: unknown[]): Promise<void> {
  const response = await fetch(`${url}/rest/v1/${table}?on_conflict=${conflictKey}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey as string,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(`${table}: HTTP ${response.status} — ${await response.text()}`);
  }
}

// ZIP centroids (~33k rows), batched to keep request bodies small.
const csv = readFileSync(resolve(root, 'supabase/seed-data/zcta_centroids.csv'), 'utf8');
const centroids = csv
  .split('\n')
  .slice(1) // header
  .filter((line) => line.trim().length > 0)
  .map((line) => {
    const [zip, latitude, longitude] = line.split(',');
    return { zip, latitude: Number(latitude), longitude: Number(longitude) };
  });

const BATCH = 2000;
for (let i = 0; i < centroids.length; i += BATCH) {
  await upsert('zip_centroids', 'zip', centroids.slice(i, i + BATCH));
  process.stdout.write(
    `\rzip_centroids: ${Math.min(i + BATCH, centroids.length)}/${centroids.length}`,
  );
}
console.log('\nDone.');
