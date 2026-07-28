import { describe, expect, it } from 'vitest';
import { isCommercialVenue } from './feedAmericaFood.ts';

/**
 * These are REAL names that were sitting in the food category on 2026-07-28, taken
 * verbatim from the live table. The aggregator blends SNAP-accepting retailers in
 * with pantries, and a veteran who taps Food and is shown KFC concludes the app is
 * junk — correctly.
 *
 * This test exists because the first version of the filter used Postgres word
 * boundaries (`\m`/`\M`) inside a JavaScript regex, where they are identity escapes
 * for the letters m and M. It therefore matched nothing, and my manual spot-check
 * passed anyway because the sample names happened to trip the separate `#` rule.
 * Every case below is asserted individually so that cannot happen again.
 */
describe('isCommercialVenue', () => {
  it.each([
    'Subway # 42247',
    'WALMART #5663',
    'Pizza Hut #26198',
    'Great Am Chicken Corp dba KFC E791005',
    "McDonald's Restaurants",
    'Subway 20053',
    'Subway 62014',
    "McDONALD'S  29370",
    'Dl United Inc. - Subway 28478',
    'Kfc #C191005',
    'M.Baker Management Inc (KFC C301022)',
    'Amrit & Harman Inc Subway 2748',
    'Kfc K312047',
    "Stingley Management Inc- McDonald's 34450",
    '7-Eleven',
    'Dollar General',
    'CVS Pharmacy',
    'Starbucks',
  ])('drops the retailer %s', (name) => {
    expect(isCommercialVenue(name)).toBe(true);
  });

  it.each([
    'Rhode Island Community Food Bank',
    'Jonnycake Center of Westerly',
    "St Mary's Kitchen",
    'The Bread of Life Bakery',
    'McDonald Mission Center', // a mission named after a person, not the chain
    'Community Deli Ministry',
    'Loaves & Fishes',
    'Salvation Army Corps Community Center',
    'Second Harvest Food Bank',
    'Meals on Wheels',
  ])('keeps the real food programme %s', (name) => {
    expect(isCommercialVenue(name)).toBe(false);
  });
});
