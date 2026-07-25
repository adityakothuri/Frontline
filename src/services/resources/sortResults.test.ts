import { describe, expect, it } from 'vitest';
import { makeResult } from '@/test/factories';
import {
  compareByDistanceThenVerification,
  filterReferralsByState,
  isNationalReferral,
  sortSearchResults,
} from './sortResults';

describe('isNationalReferral', () => {
  it('is true for a veteran resource with no pinpoint (null coords + null address)', () => {
    expect(
      isNationalReferral(makeResult({ latitude: null, longitude: null, address: null }).resource),
    ).toBe(true);
  });

  it('is false for a general (non-veteran) no-coord row', () => {
    expect(
      isNationalReferral(
        makeResult({ latitude: null, longitude: null, address: null, veteran_relevance: 'general' }).resource,
      ),
    ).toBe(false);
  });

  it('is false when the row still has a street address (a place, not a referral)', () => {
    expect(isNationalReferral(makeResult({ latitude: null, longitude: null }).resource)).toBe(false);
  });
});

describe('filterReferralsByState', () => {
  const caReferral = makeResult({ id: 'ca', tags: ['state:CA'], latitude: null, longitude: null, address: null });
  const national = makeResult({ id: 'nat', tags: [], latitude: null, longitude: null, address: null });

  it('keeps a state-tagged referral only for that state', () => {
    expect(filterReferralsByState([caReferral, national], 'CA').map((r) => r.resource.id)).toEqual(['ca', 'nat']);
    expect(filterReferralsByState([caReferral, national], 'TX').map((r) => r.resource.id)).toEqual(['nat']);
  });

  it('drops state-scoped referrals when the veteran state is unknown', () => {
    expect(filterReferralsByState([caReferral, national], null).map((r) => r.resource.id)).toEqual(['nat']);
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
    expect(compareByDistanceThenVerification(makeResult({}, 8), makeResult({}, null))).toBeLessThan(0);
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
