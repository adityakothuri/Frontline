/**
 * Frontline Phase 10 seed script — upserts the curated resource rows and the
 * Census ZCTA zip centroids into Supabase via PostgREST.
 *
 * Run (Node >= 22):  node --experimental-strip-types scripts/seed.ts
 * Requires env:      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *                    (shell env or a git-ignored .env.seed — never EXPO_PUBLIC_*)
 *
 * Curation honesty: every row in resources.la.json carries its own
 * human-verified last_checked / verification_status. This script uploads them
 * VERBATIM — it never stamps now() on anything. To mark a resource verified,
 * a human edits the JSON (date + status) and re-runs the seed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function loadSeedEnv(): void {
  try {
    const raw = readFileSync(resolve(root, '.env.seed'), 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // No .env.seed — fine, the shell env may carry the values.
  }
}

loadSeedEnv();
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

// 1. Curated resources (12 rows today; grows city by city).
const resources = JSON.parse(
  readFileSync(resolve(root, 'supabase/seed-data/resources.la.json'), 'utf8'),
);
await upsert('resources', 'id', resources);
console.log(`resources: upserted ${resources.length} rows`);

// 2. ZIP centroids (~33k rows), batched to keep request bodies small.
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
  process.stdout.write(`\rzip_centroids: ${Math.min(i + BATCH, centroids.length)}/${centroids.length}`);
}
console.log('\nDone.');
