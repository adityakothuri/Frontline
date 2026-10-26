import { describe, expect, it } from 'vitest';
import { makeResult } from '@/test/factories';
import {
  compareByDistanceThenVerification,
  demoteDownvoted,
  filterReferralsByState,
  isNationalReferral,
  splitLocalsAndReferrals,
  sortSearchResults,
} from './sortResults';
import type { Rating } from '@/types/activity';

describe('demoteDownvoted', () => {
  const ids = (results: ReturnType<typeof makeResult>[]) => results.map((r) => r.resource.id);
  const list = [makeResult({ id: 'a' }), makeResult({ id: 'b' }), makeResult({ id: 'c' })];
  const ratedDown =
    (...down: string[]) =>
    (id: string): Rating | undefined =>
      down.includes(id) ? 'down' : undefined;

  it('sinks a downvoted place below everything else', () => {
    expect(ids(demoteDownvoted(list, ratedDown('a')))).toEqual(['b', 'c', 'a']);
  });

  it('leaves the order of everything else untouched', () => {
    expect(ids(demoteDownvoted(list, ratedDown('b')))).toEqual(['a', 'c', 'b']);
  });

  it('keeps sunk places in their original order relative to each other', () => {
    expect(ids(demoteDownvoted(list, ratedDown('a', 'b')))).toEqual(['c', 'a', 'b']);
  });

  it('is a no-op when nothing is rated down, and skips the copy', () => {
    expect(demoteDownvoted(list, () => undefined)).toBe(list);
    expect(demoteDownvoted(list, ratedDown('nothing-here'))).toBe(list);
  });

  it('ignores an upvote — only "not helpful" moves anything', () => {
    expect(demoteDownvoted(list, () => 'up')).toBe(list);
  });

  it('is stable when every place is rated down, and skips the copy then too', () => {
    // Everything sinking is the same order as nothing sinking, so this takes the
    // same shortcut rather than allocating a rearrangement of the whole list.
    expect(demoteDownvoted(list, ratedDown('a', 'b', 'c'))).toBe(list);
    expect(ids(demoteDownvoted(list, ratedDown('a', 'b', 'c')))).toEqual(['a', 'b', 'c']);
  });
});

describe('isNationalReferral', () => {
  it('is true for a veteran resource with no pinpoint (null coords + null address)', () => {
    expect(
      isNationalReferral(makeResult({ latitude: null, longitude: null, address: null }).resource),
    ).toBe(true);
  });

  it('is false for a general (non-veteran) no-coord row', () => {
    expect(
      isNationalReferral(
        makeResult({ latitude: null, longitude: null, address: null, veteran_relevance: 'general' })
          .resource,
      ),
    ).toBe(false);
  });

  it('is false when the row still has a street address (a place, not a referral)', () => {
    expect(isNationalReferral(makeResult({ latitude: null, longitude: null }).resource)).toBe(
      false,
    );
  });
});

describe('filterReferralsByState', () => {
  const caReferral = makeResult({
    id: 'ca',
    tags: ['state:CA'],
    latitude: null,
    longitude: null,
    address: null,
  });
  const national = makeResult({
    id: 'nat',
    tags: [],
    latitude: null,
    longitude: null,
    address: null,
  });

  it('keeps a state-tagged referral only for that state', () => {
    expect(filterReferralsByState([caReferral, national], 'CA').map((r) => r.resource.id)).toEqual([
      'ca',
      'nat',
    ]);
    expect(filterReferralsByState([caReferral, national], 'TX').map((r) => r.resource.id)).toEqual([
      'nat',
    ]);
  });

  it('drops state-scoped referrals when the veteran state is unknown', () => {
    expect(filterReferralsByState([caReferral, national], null).map((r) => r.resource.id)).toEqual([
      'nat',
    ]);
  });
});

describe('splitLocalsAndReferrals', () => {
  const referral = makeResult({
    id: 'nat',
    tags: [],
    latitude: null,
    longitude: null,
    address: null,
  });
  const local = (id: string) =>
    makeResult({ id, latitude: 40, longitude: -74, address: '1 Main St' });

  it('separates nearby places from statewide/national referrals', () => {
    const { locals, referrals } = splitLocalsAndReferrals([referral, local('a')], 'NY');
    expect(locals.map((r) => r.resource.id)).toEqual(['a']);
    expect(referrals.map((r) => r.resource.id)).toEqual(['nat']);
  });

  it('leads with referrals when there is almost nothing nearby', () => {
    expect(splitLocalsAndReferrals([referral, local('a')], 'NY').referralsLead).toBe(true);
  });

  it('does not lead with referrals once local results are plentiful', () => {
    const results = [referral, local('a'), local('b'), local('c')];
    expect(splitLocalsAndReferrals(results, 'NY').referralsLead).toBe(false);
  });

  it('still applies the state filter to referrals', () => {
    const caReferral = makeResult({
      id: 'ca',
      tags: ['state:CA'],
      latitude: null,
      longitude: null,
      address: null,
    });
    expect(splitLocalsAndReferrals([caReferral], 'TX').referrals).toEqual([]);
  });
});

describe('compareByDistanceThenVerification', () => {
  it('sorts nearer first', () => {
    expect(compareByDistanceThenVerification(makeResult({}, 1), makeResult({}, 5))).toBeLessThan(0);
  });

  it('breaks a distance tie veteran-first', () => {
    const veteran = makeResult({ veteran_relevance: 'veteran_specific' }, 2);
    const general = makeResult({ veteran_relevance: 'general' }, 2);
    expect(compareByDistanceThenVerification(veteran, general)).toBeLessThan(0);
  });

  it('sorts null distances (location-independent) last', () => {
    expect(compareByDistanceThenVerification(makeResult({}, 8), makeResult({}, null))).toBeLessThan(
      0,
    );
  });
});

describe('sortSearchResults', () => {
  it('leads with open-now for "today" urgency', () => {
    const openFar = makeResult({ id: 'open' }, 9, true);
    const closedNear = makeResult({ id: 'closed' }, 1, false);
    expect(sortSearchResults([closedNear, openFar], 'today')[0].resource.id).toBe('open');
  });

  it('leads with nearest for non-urgent needs', () => {
    const openFar = makeResult({ id: 'open' }, 9, true);
    const closedNear = makeResult({ id: 'closed' }, 1, false);
    expect(sortSearchResults([openFar, closedNear], 'info')[0].resource.id).toBe('closed');
  });
});
