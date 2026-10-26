import { afterEach, describe, expect, it, vi } from 'vitest';
import { reap } from './reap.ts';

/**
 * The reaper deletes rows, so the tests that matter are the ones proving it
 * *refuses* to. The safety floor is the only thing standing between a partial
 * provider fetch (Feeding America 500s under load, va.gov drops large
 * downloads) and a wiped category.
 */

const REST = { url: 'https://example.supabase.co', key: 'service-role-key' };
const ARGS = {
  provider: 'va-facilities',
  runDate: '2026-07-28',
  maxFraction: 0.2,
  dryRun: false,
};

/**
 * Stand in for PostgREST: HEAD requests answer with a Content-Range count,
 * keyed on whether the URL carries the `ingested_at=lt.` stale filter. Returns
 * the recorded DELETE urls so a test can assert none were issued.
 */
function mockRest({ total, stale }: { total: number; stale: number }) {
  const deletes: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
    if (init?.method === 'DELETE') {
      deletes.push(url);
      return new Response(null, { status: 204 });
    }
    const count = url.includes('ingested_at=lt.') ? stale : total;
    return new Response(null, {
      status: 200,
      headers: { 'content-range': count === 0 ? '*/0' : `0-999/${count}` },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { deletes, fetchMock };
}

/** A count response whose total is the literal `content-range` value given. */
function mockRestWithRange(range: string | null) {
  const deletes: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === 'DELETE') {
        deletes.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response(null, {
        status: 200,
        headers: range === null ? {} : { 'content-range': range },
      });
    }),
  );
  return { deletes };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reap', () => {
  it('deletes stale rows when churn is within the floor', async () => {
    const { deletes } = mockRest({ total: 1000, stale: 50 });
    await expect(reap(REST, ARGS)).resolves.toBe(50);
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain('source_provider=eq.va-facilities');
    expect(deletes[0]).toContain('ingested_at=lt.2026-07-28');
  });

  it('refuses and deletes nothing when a partial fetch would blow the floor', async () => {
    // 300/1000 = 30%: the shape of a run that lost pages.
    const { deletes } = mockRest({ total: 1000, stale: 300 });
    await expect(reap(REST, ARGS)).rejects.toThrow(/over the 20% floor/);
    expect(deletes).toEqual([]);
  });

  it('treats exactly the floor as acceptable churn', async () => {
    const { deletes } = mockRest({ total: 1000, stale: 200 });
    await expect(reap(REST, ARGS)).resolves.toBe(200);
    expect(deletes).toHaveLength(1);
  });

  it('does nothing when every row was refreshed by this run', async () => {
    const { deletes } = mockRest({ total: 1000, stale: 0 });
    await expect(reap(REST, ARGS)).resolves.toBe(0);
    expect(deletes).toEqual([]);
  });

  it('does nothing when the provider has no rows, rather than dividing by zero', async () => {
    // A failed run leaves no rows; that is the freshness gate's alarm, not ours.
    const { deletes } = mockRest({ total: 0, stale: 0 });
    await expect(reap(REST, ARGS)).resolves.toBe(0);
    expect(deletes).toEqual([]);
  });

  it('reports what it would delete on a dry run without issuing the delete', async () => {
    const { deletes } = mockRest({ total: 1000, stale: 50 });
    await expect(reap(REST, { ...ARGS, dryRun: true })).resolves.toBe(50);
    expect(deletes).toEqual([]);
  });

  it('honours an explicitly looser floor passed for a high-churn feed', async () => {
    // 60% turnover would trip the default floor, but a caller may opt in to it.
    const { deletes } = mockRest({ total: 1000, stale: 600 });
    await expect(reap(REST, { ...ARGS, maxFraction: 0.9 })).resolves.toBe(600);
    expect(deletes).toHaveLength(1);
  });

  // `Number('*')` is NaN and every comparison against NaN is false, including
  // `NaN > maxFraction` — so an unguarded non-numeric count walks through the
  // zero check, the no-stale check and the floor, and deletes everything.
  it('refuses when the count is `*`, rather than letting NaN disable the floor', async () => {
    const { deletes } = mockRestWithRange('0-999/*');
    await expect(reap(REST, ARGS)).rejects.toThrow(/not a number|rather than a number/);
    expect(deletes).toEqual([]);
  });

  it('refuses when the count header is missing entirely', async () => {
    const { deletes } = mockRestWithRange(null);
    await expect(reap(REST, ARGS)).rejects.toThrow(/content-range/);
    expect(deletes).toEqual([]);
  });

  it('encodes the provider so a key with a slash cannot alter the filter', async () => {
    const { deletes } = mockRest({ total: 100, stale: 1 });
    await reap(REST, { ...ARGS, provider: 'weird/provider' });
    expect(deletes[0]).toContain('source_provider=eq.weird%2Fprovider');
  });
});
