/**
 * Reaper — deletes a provider's rows that its latest run did not refresh, i.e.
 * the resources that disappeared upstream. `upsert.ts` only ever upserts, so
 * without this a closed clinic would stay listed forever.
 *
 * Every adapter stamps `ingested_at` with the run date, so "not refreshed by the
 * latest run" is exactly `ingested_at < <run date>` scoped to one provider.
 *
 * Providers fail *partially* (Feed America 500s under load, va.gov drops large
 * downloads), and a naive delete after a partial fetch would wipe the rest of
 * the category. So a reap that would remove more than the max fraction of a
 * provider's rows refuses and exits non-zero; a genuine mass removal is a
 * migration a human writes (e.g. 0028_purge_zip_centroid_vso_rows.sql).
 *
 *   node --experimental-strip-types ingestion/reap.ts <provider> \
 *     [--run-date=YYYY-MM-DD] [--max-fraction=0.2] [--dry-run]
 */
import { resolve } from 'node:path';
import { loadEnvFile } from './lib/env.ts';

/**
 * Refuse to delete more than this share of a provider's rows in one reap: well
 * above real churn for a directory of places, well below a partial fetch. A
 * high-churn feed must pass a looser `--max-fraction` explicitly at the call site.
 */
const DEFAULT_MAX_REAP_FRACTION = 0.2;

interface ReapArgs {
  provider: string;
  runDate: string;
  maxFraction: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): ReapArgs {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const provider = positional[0];
  if (!provider) {
    throw new Error(
      'usage: reap.ts <provider> [--run-date=YYYY-MM-DD] [--max-fraction=0.2] [--dry-run]',
    );
  }
  const runDateArg = argv.find((a) => a.startsWith('--run-date='))?.split('=')[1];
  const runDate = runDateArg ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
    throw new Error(`reap: --run-date must be YYYY-MM-DD, got "${runDate}"`);
  }
  const fractionArg = argv.find((a) => a.startsWith('--max-fraction='))?.split('=')[1];
  const maxFraction = fractionArg === undefined ? DEFAULT_MAX_REAP_FRACTION : Number(fractionArg);
  if (!Number.isFinite(maxFraction) || maxFraction <= 0 || maxFraction > 1) {
    throw new Error(`reap: --max-fraction must be in (0, 1], got "${fractionArg}"`);
  }
  return { provider, runDate, maxFraction, dryRun: argv.includes('--dry-run') };
}

interface Rest {
  url: string;
  key: string;
}

/** PostgREST exact count without fetching the rows. */
async function countRows(rest: Rest, filter: string): Promise<number> {
  const response = await fetch(`${rest.url}/rest/v1/resources?${filter}&select=id`, {
    method: 'HEAD',
    headers: {
      apikey: rest.key,
      Authorization: `Bearer ${rest.key}`,
      Prefer: 'count=exact',
    },
  });
  if (!response.ok) throw new Error(`reap: count HTTP ${response.status}`);

  // Content-Range is `<range>/<total>` (`0-999/17139`, or `*/0` for no match);
  // the total is `*` if the exact count was not computed. This parse is the
  // floor's single point of failure: `Number('*')` is NaN, every comparison with
  // NaN is false, and an unchecked NaN would walk past every guard and delete all.
  const total = response.headers.get('content-range')?.split('/')[1];
  if (total === undefined) throw new Error('reap: no content-range in count response');
  const count = Number(total);
  if (!Number.isFinite(count)) {
    throw new Error(
      `reap: count came back as "${total}" rather than a number — the exact count was not ` +
        `computed, so the safety floor cannot be trusted. Refusing to delete anything.`,
    );
  }
  return count;
}

async function deleteRows(rest: Rest, filter: string): Promise<void> {
  const response = await fetch(`${rest.url}/rest/v1/resources?${filter}`, {
    method: 'DELETE',
    headers: { apikey: rest.key, Authorization: `Bearer ${rest.key}` },
  });
  if (!response.ok) {
    throw new Error(`reap: delete HTTP ${response.status} — ${await response.text()}`);
  }
}

export async function reap(rest: Rest, args: ReapArgs): Promise<number> {
  const providerFilter = `source_provider=eq.${encodeURIComponent(args.provider)}`;
  const staleFilter = `${providerFilter}&ingested_at=lt.${args.runDate}`;

  const [total, stale] = await Promise.all([
    countRows(rest, providerFilter),
    countRows(rest, staleFilter),
  ]);

  if (total === 0) {
    // No rows at all means the run never landed; that is the freshness gate's
    // job to shout about, and there is nothing here to reap.
    console.log(`[reap] ${args.provider}: no rows — nothing to do.`);
    return 0;
  }
  if (stale === 0) {
    console.log(`[reap] ${args.provider}: all ${total} rows refreshed on ${args.runDate}.`);
    return 0;
  }

  const fraction = stale / total;
  const pct = (fraction * 100).toFixed(1);
  if (fraction > args.maxFraction) {
    throw new Error(
      `reap: ${args.provider} would delete ${stale} of ${total} rows (${pct}%), over the ` +
        `${(args.maxFraction * 100).toFixed(0)}% floor. This looks like a partial fetch, not real ` +
        `churn — the run probably lost pages. Re-run the source; if the removal is genuine (a ` +
        `provider changing its id scheme), write a migration instead.`,
    );
  }

  if (args.dryRun) {
    console.log(
      `[reap] dry run — would delete ${stale} of ${total} ${args.provider} rows (${pct}%).`,
    );
    return stale;
  }

  await deleteRows(rest, staleFilter);
  console.log(
    `[reap] ${args.provider}: deleted ${stale} of ${total} rows (${pct}%) not seen on ${args.runDate}.`,
  );
  return stale;
}

// Run only as a script, not when imported by a test.
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  loadEnvFile(resolve(import.meta.dirname, '..', '.env.seed'));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('reap: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  try {
    await reap({ url, key }, parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(`\n${String(err)}`);
    process.exit(1);
  }
}
