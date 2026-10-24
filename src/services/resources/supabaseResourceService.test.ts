import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeResource } from '@/test/factories';
import type { Need } from '@/types/need';

const supabaseRequest = vi.hoisted(() => vi.fn());
vi.mock('../supabase/client', () => ({ supabaseRequest }));

const { SupabaseResourceService } = await import('./supabaseResourceService');
const { invalidateResourceCache } = await import('./resourceCache');

/** RPC rows: a located row carries a distance, a referral carries null. */
const located = (id: string, distance = 2) => ({
  resource: makeResource({ id }),
  distance_miles: distance,
});
const referral = (id: string) => ({
  resource: makeResource({ id, latitude: null, longitude: null, address: null }),
  distance_miles: null,
});

const needAt = (location: Need['location']): Need =>
  ({ category: 'housing', urgency: 'this_week', modality: 'either', location }) as Need;

const radiiRequested = () =>
  supabaseRequest.mock.calls.map(
    ([, init]) => (init as { body: { radius_miles: number } }).body.radius_miles,
  );

describe('SupabaseResourceService.search — radius widening', () => {
  const service = new SupabaseResourceService();

  beforeEach(() => {
    supabaseRequest.mockReset();
    // The service caches reads for the session; these cases reuse identical
    // queries, so each needs a clean one.
    invalidateResourceCache();
  });

  it('does not widen when the first search already has enough nearby places', async () => {
    supabaseRequest.mockResolvedValue([located('a'), located('b'), located('c')]);

    await service.search({ need: needAt({ zip: '78701', radiusMiles: 15 }) });

    expect(radiiRequested()).toEqual([15]);
  });

  it('makes one wide search and trims it to the smallest step with enough', async () => {
    supabaseRequest
      .mockResolvedValueOnce([located('a')])
      .mockResolvedValueOnce([
        located('a', 2),
        located('b', 20),
        located('c', 40),
        located('d', 90),
      ]);

    const results = await service.search({ need: needAt({ zip: '59829', radiusMiles: 15 }) });

    expect(radiiRequested()).toEqual([15, 100]);
    // a, b, c fall within 50 — the smallest step holding three — so d is cut.
    expect(results.map((r) => r.resource.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps every wide result when no smaller step holds enough', async () => {
    supabaseRequest
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([located('a', 60), located('b', 90)]);

    const results = await service.search({ need: needAt({ zip: '59829', radiusMiles: 15 }) });

    expect(results).toHaveLength(2);
  });

  it('does not widen past the widest step', async () => {
    supabaseRequest.mockResolvedValue([located('a')]);

    await service.search({ need: needAt({ zip: '59829', radiusMiles: 100 }) });

    expect(radiiRequested()).toEqual([100]);
  });

  // Referrals ignore the radius, so counting them would make an empty rural area
  // look covered and suppress the widening entirely.
  it('does not count referrals as local results', async () => {
    supabaseRequest
      .mockResolvedValueOnce([referral('hotline'), referral('ssvf')])
      .mockResolvedValue([located('a'), located('b'), located('c')]);

    await service.search({ need: needAt({ zip: '59829', radiusMiles: 15 }) });

    expect(radiiRequested()).toEqual([15, 100]);
  });

  // Without an origin there is no distance, so a wider search returns the same rows.
  it('does not widen when there is no search origin', async () => {
    supabaseRequest.mockResolvedValue([referral('hotline')]);

    await service.search({ need: needAt({ radiusMiles: 15 }) });

    expect(radiiRequested()).toEqual([15]);
  });

  it('keeps the narrower results when a widening query fails', async () => {
    supabaseRequest
      .mockResolvedValueOnce([located('a')])
      .mockRejectedValue(new Error('statement timeout'));

    const results = await service.search({ need: needAt({ zip: '59829', radiusMiles: 15 }) });

    expect(results.map((r) => r.resource.id)).toEqual(['a']);
  });
});

/**
 * The 0027 migration filters and ranks statewide referrals server-side, which
 * only works if the caller tells it the veteran's state. Nothing asserted that
 * before, so a silent regression here would quietly hand veterans out-of-state
 * referrals that the client filter then discards, leaving them nothing.
 */
describe('SupabaseResourceService — veteran_state reaches the RPC', () => {
  const service = new SupabaseResourceService();

  beforeEach(() => {
    supabaseRequest.mockReset();
    // The service caches reads for the session; these cases reuse identical
    // queries, so each needs a clean one.
    invalidateResourceCache();
    supabaseRequest.mockResolvedValue([located('a'), located('b'), located('c')]);
  });

  const bodyOf = (call: number) =>
    supabaseRequest.mock.calls[call][1] as { body: Record<string, unknown> };

  it('derives the state from the ZIP on search', async () => {
    await service.search({ need: needAt({ zip: '02903', radiusMiles: 25 }) });
    expect(bodyOf(0).body.veteran_state).toBe('RI');
  });

  it('sends null when there is no ZIP to derive a state from', async () => {
    await service.search({ need: needAt({ latitude: 41.8, longitude: -71.4, radiusMiles: 25 }) });
    expect(bodyOf(0).body.veteran_state).toBeNull();
  });

  it('derives the state on browse too', async () => {
    await service.listResources('housing', '77002', 25);
    expect(bodyOf(0).body.veteran_state).toBe('TX');
  });

  it('sends null on browse when no ZIP is given', async () => {
    await service.listResources('housing');
    expect(bodyOf(0).body.veteran_state).toBeNull();
  });
});

/**
 * Discover and Map open on the identical browse query, so a cold launch used to
 * pay for it twice — and again on every tab switch. These pin the dedup and the
 * "an error stays retryable" rule, both of which are easy to break silently.
 */
describe('SupabaseResourceService — session cache', () => {
  const service = new SupabaseResourceService();

  beforeEach(() => {
    supabaseRequest.mockReset();
    invalidateResourceCache();
  });

  it('issues one request when two callers browse the same thing at once', async () => {
    supabaseRequest.mockResolvedValue([located('a')]);

    await Promise.all([
      service.listResources(undefined, '78701', 25),
      service.listResources(undefined, '78701', 25),
    ]);

    expect(supabaseRequest).toHaveBeenCalledTimes(1);
  });

  it('serves a repeat browse from the cache', async () => {
    supabaseRequest.mockResolvedValue([located('a')]);

    await service.listResources(undefined, '78701', 25);
    const second = await service.listResources(undefined, '78701', 25);

    expect(supabaseRequest).toHaveBeenCalledTimes(1);
    expect(second).toHaveLength(1);
  });

  it('still queries when the browse differs', async () => {
    supabaseRequest.mockResolvedValue([located('a')]);

    await service.listResources(undefined, '78701', 25);
    await service.listResources(undefined, '02903', 25);

    expect(supabaseRequest).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failure — the next attempt is real', async () => {
    supabaseRequest.mockRejectedValueOnce(new Error('network')).mockResolvedValue([located('a')]);

    await expect(service.listResources(undefined, '78701', 25)).rejects.toThrow('network');
    const retried = await service.listResources(undefined, '78701', 25);

    expect(supabaseRequest).toHaveBeenCalledTimes(2);
    expect(retried).toHaveLength(1);
  });
});

describe('SupabaseResourceService — detail and saved reads', () => {
  const service = new SupabaseResourceService();

  beforeEach(() => {
    supabaseRequest.mockReset();
    invalidateResourceCache();
  });

  it('opens a resource from a list without another request', async () => {
    supabaseRequest.mockResolvedValue([located('a')]);
    await service.listResources(undefined, '78701', 15);

    const resource = await service.getById('a');

    expect(resource?.id).toBe('a');
    expect(supabaseRequest).toHaveBeenCalledTimes(1);
  });

  it('resolves many ids in one request and leaves retired ids out', async () => {
    supabaseRequest.mockResolvedValue([makeResource({ id: 'a' }), makeResource({ id: 'b' })]);

    const found = await service.getByIds(['a', 'b', 'gone']);

    expect(supabaseRequest).toHaveBeenCalledTimes(1);
    expect([...found.keys()].sort()).toEqual(['a', 'b']);
  });

  it('only asks for the ids it does not already hold', async () => {
    supabaseRequest.mockResolvedValueOnce([located('a')]);
    await service.listResources(undefined, '78701', 15);
    supabaseRequest.mockResolvedValueOnce([makeResource({ id: 'b' })]);

    await service.getByIds(['a', 'b']);

    const [path] = supabaseRequest.mock.calls[1] as [string];
    expect(decodeURIComponent(path)).toContain('in.("b")');
  });
});
