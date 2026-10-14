/**
 * Reaper — deletes a provider's rows that its latest run did not refresh, i.e.
 * the resources that have disappeared from the upstream feed.
 *
 * WHY THIS EXISTS
 *
 * `upsert.ts` only ever upserts. Nothing has ever removed a row that vanished
 * from a provider, so a closed VA clinic or a shut-down food pantry stays in the
 * catalogue forever, indistinguishable from an open one — the 2026-07-28 data
 * audit flagged this as the one data-integrity gap with no mechanism at all
 * behind it. Sending a veteran to a place that closed is worse than not listing
 * it, because they spend the trip finding out.
 *
 * Every adapter stamps `ingested_at` with the run date, so "not refreshed by the
 * latest run" is exactly `ingested_at < <run date>` scoped to one provider.
 *
 * THE SAFETY FLOOR IS THE WHOLE DESIGN
 *
 * A reaper that trusts its input is a data-loss bug waiting for a bad afternoon.
 * Providers in this pipeline fail *partially*: Feeding America 500s under
 * parallel load and the adapter tolerates losing up to 10% of its pages, va.gov
 * drops large downloads with ECONNRESET, and the Census geocoder times out in
 * 20-minute batches. Any of those can end a run holding a fraction of the real
 * dataset, and a naive delete would then wipe the rest of the category.
 *
 * So a reap that would remove more than MAX_REAP_FRACTION of a provider's rows
 * refuses and exits non-zero. A genuine mass removal — a provider changing its
 * id scheme, say — is then a deliberate migration a human writes, which is what
 * 0028_purge_zip_centroid_vso_rows.sql is.
 *
 *   node --experimental-strip-types ingestion/reap.ts <provider> \
 *     [--run-date=YYYY-MM-DD] [--max-fraction=0.2] [--dry-run]
 */
import { resolve } from 'node:path';
import { loadEnvFile } from './lib/env.ts';

/**
 * Refuse to delete more than this share of a provider's rows in one reap.
 * A fifth is comfortably above real churn for a *directory of places* (providers
 * move a handful of sites a month) and far below any partial-fetch failure mode.
 *
 * A feed of postings rather than places — USAJOBS, where listings close
 * constantly and high turnover is the correct behaviour, not a symptom — needs a
 * looser floor, passed explicitly at the call site so the exception is visible.
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

  // Content-Range is `<range>/<total>` — e.g. `0-999/17139`, or `*/0` when
  // nothing matches. The total is `*` when the count was NOT computed, which
  // happens if `Prefer: count=exact` is stripped by a proxy or dropped by a
  // future PostgREST version.
  //
  // This parse is the floor's single point of failure, so it is strict.
  // `Number('*')` is NaN, and every comparison against NaN is false — including
  // `NaN > maxFraction`. An unchecked NaN therefore walks straight through the
  // zero-rows check, the no-stale check AND the floor, and deletes the
  // provider's entire row set with the safety guard silently off.
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
