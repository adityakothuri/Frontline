import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeResource } from '@/test/factories';
import type { Need } from '@/types/need';

const supabaseRequest = vi.hoisted(() => vi.fn());
vi.mock('../supabase/client', () => ({ supabaseRequest }));

const { SupabaseResourceService } = await import('./supabaseResourceService');

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
  supabaseRequest.mock.calls.map(([, init]) => (init as { body: { radius_miles: number } }).body.radius_miles);

describe('SupabaseResourceService.search — radius widening', () => {
  const service = new SupabaseResourceService();

  beforeEach(() => {
    supabaseRequest.mockReset();
  });

  it('does not widen when the first search already has enough nearby places', async () => {
    supabaseRequest.mockResolvedValue([located('a'), located('b'), located('c')]);

    await service.search({ need: needAt({ zip: '78701', radiusMiles: 15 }) });

    expect(radiiRequested()).toEqual([15]);
  });

  it('widens through the steps while local results stay thin', async () => {
    supabaseRequest
      .mockResolvedValueOnce([located('a')])
      .mockResolvedValueOnce([located('a')])
      .mockResolvedValueOnce([located('a'), located('b'), located('c')]);

    const results = await service.search({ need: needAt({ zip: '59829', radiusMiles: 15 }) });

    expect(radiiRequested()).toEqual([15, 25, 50]);
    expect(results).toHaveLength(3);
  });

  it('never searches a ring smaller than the veteran asked for', async () => {
    supabaseRequest.mockResolvedValue([located('a')]);

    await service.search({ need: needAt({ zip: '59829', radiusMiles: 50 }) });

    expect(radiiRequested()).toEqual([50, 100]);
  });

  // Referrals ignore the radius, so counting them would make an empty rural area
  // look covered and suppress the widening entirely.
  it('does not count referrals as local results', async () => {
    supabaseRequest
      .mockResolvedValueOnce([referral('hotline'), referral('ssvf')])
      .mockResolvedValue([located('a'), located('b'), located('c')]);

    await service.search({ need: needAt({ zip: '59829', radiusMiles: 15 }) });

    expect(radiiRequested()).toEqual([15, 25]);
  });

  // Without an origin the RPC returns every row with a null distance and applies
  // no radius, so widening would re-fetch the same payload three times.
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
 * 35% of the catalogue (72,286 rows) has no phone and no website — the IRS
 * veterans posts, most Feeding America pantries, the USAspending grantees. They
 * have real addresses, so they belong in the data; but sorted purely by distance
 * they bury the places that answer the phone.
 */
describe('SupabaseResourceService — uncontactable rows are capped', () => {
  const service = new SupabaseResourceService();

  beforeEach(() => {
    supabaseRequest.mockReset();
  });

  /** A located row a veteran cannot reach: no phone, no website. */
  const uncontactable = (id: string, distance: number) => ({
    resource: makeResource({ id, category: 'community_support', phone: null, website: null }),
    distance_miles: distance,
  });
  const callable = (id: string, distance: number) => ({
    resource: makeResource({ id, category: 'community_support', phone: '555-0100' }),
    distance_miles: distance,
  });

  it('keeps at most five uncontactable rows per category', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => uncontactable(`u${i}`, i + 1));
    supabaseRequest.mockResolvedValue(rows);

    const results = await service.search({ need: needAt({ zip: '77002', radiusMiles: 25 }) });

    expect(results).toHaveLength(5);
    // The nearest five survive, since the cap runs after the distance sort.
    expect(results.map((r) => r.resource.id)).toEqual(['u0', 'u1', 'u2', 'u3', 'u4']);
  });

  it('never drops a row a veteran can actually contact', async () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => uncontactable(`u${i}`, i + 1)),
      ...Array.from({ length: 8 }, (_, i) => callable(`c${i}`, i + 20)),
    ];
    supabaseRequest.mockResolvedValue(rows);

    const results = await service.search({ need: needAt({ zip: '77002', radiusMiles: 25 }) });

    // All 8 callable rows survive even though every one is further away.
    expect(results.filter((r) => r.resource.phone !== null)).toHaveLength(8);
    expect(results.filter((r) => r.resource.phone === null)).toHaveLength(5);
  });

  it('caps per category rather than across the whole result set', async () => {
    supabaseRequest.mockResolvedValue([
      ...Array.from({ length: 7 }, (_, i) => uncontactable(`cs${i}`, i + 1)),
      ...Array.from({ length: 7 }, (_, i) => ({
        resource: makeResource({ id: `f${i}`, category: 'food', phone: null, website: null }),
        distance_miles: i + 1,
      })),
    ]);

    const results = await service.search({ need: needAt({ zip: '77002', radiusMiles: 25 }) });

    expect(results.filter((r) => r.resource.category === 'community_support')).toHaveLength(5);
    expect(results.filter((r) => r.resource.category === 'food')).toHaveLength(5);
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
