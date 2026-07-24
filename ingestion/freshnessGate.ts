/**
 * Freshness gate — fails (exit 1) when any data source has aged past its
 * refresh cadence, so a silently-broken pipeline becomes a loud CI failure
 * instead of a slowly rotting app. Run by `.github/workflows/refresh-data.yml`
 * after every refresh; runnable locally the same way:
 *
 *   node --experimental-strip-types ingestion/freshnessGate.ts
 *
 * Thresholds are cadence + slack: weekly jobs get 10 days, monthly places get
 * 40, quarterly hand-reviewed lists (curated referrals, SSVF) get 120 — when
 * those trip, the fix is a human re-review, which is exactly the point.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CADENCE_DAYS: Record<string, number> = {
  usajobs: 10, // weekly refresh
  'va-facilities': 40, // monthly
  'va-gi-bill': 40, // monthly
  'lsc-legal-aid': 40, // monthly
  'hud-housing-counseling': 40, // monthly
  'curated-national': 120, // quarterly manual review (last_checked = verified_on)
  'ssvf-providers': 120, // quarterly manual refresh from the VA FY list
};

function loadEnvFile(file: string): void {
  try {
    const raw = readFileSync(resolve(import.meta.dirname, '..', file), 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // no .env.seed — env may come from CI secrets
  }
}

async function newestCheck(url: string, key: string, provider: string): Promise<string | null> {
  const response = await fetch(
    `${url}/rest/v1/resources?source_provider=eq.${provider}&select=last_checked&order=last_checked.desc&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!response.ok) throw new Error(`${provider}: HTTP ${response.status}`);
  const rows = (await response.json()) as { last_checked: string }[];
  return rows[0]?.last_checked ?? null;
}

loadEnvFile('.env.seed');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('freshness gate: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const failures: string[] = [];
for (const [provider, maxDays] of Object.entries(CADENCE_DAYS)) {
  const newest = await newestCheck(url, key, provider);
  if (newest === null) {
    failures.push(`${provider}: NO ROWS in the database`);
    continue;
  }
  const ageDays = (Date.now() - new Date(newest).getTime()) / 86_400_000;
  const status = ageDays > maxDays ? 'STALE' : 'ok';
  console.log(`${status.padEnd(5)} ${provider}: newest last_checked ${newest} (${Math.floor(ageDays)}d, limit ${maxDays}d)`);
  if (ageDays > maxDays) failures.push(`${provider}: ${Math.floor(ageDays)}d old (limit ${maxDays}d)`);
}

if (failures.length > 0) {
  console.error(`\nfreshness gate FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nfreshness gate passed.');
