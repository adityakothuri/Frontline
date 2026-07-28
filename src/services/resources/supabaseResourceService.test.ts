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
