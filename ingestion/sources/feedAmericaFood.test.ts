import { describe, expect, it } from 'vitest';
import { isCommercialVenue, isProvenFoodSite } from './feedAmericaFood.ts';

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

/**
 * The aggregator's food taxonomy is attached to things that are not food. Every
 * string below is the real `eligibility_description` of a row that was sitting in
 * the live `food` category on 2026-07-28 — including hospices, so a veteran
 * searching for a meal was shown end-of-life care.
 *
 * Four separate classes of non-food have now reached this category (school
 * cafeterias, mis-tagged behavioural health, SNAP retailers, and this lot), which
 * is why the logic is inverted: food must be PROVEN by the feed's own words.
 */
describe('isProvenFoodSite', () => {
  it.each([
    ['Open to anyone who needs food.', 'plain pantry'],
    ['Food pantry location in Tullahoma', 'named pantry'],
    ['Food distribution location at East Compassion Community Center', 'distribution site'],
    ["Host site for Houston Food Bank's Senior Box distributions.", 'senior box host'],
    ['Free groceries, no ID required', 'groceries'],
    ['Hot meals served daily to anyone in need', 'soup kitchen'],
    ['Mobile produce distribution, first Saturday monthly', 'mobile produce'],
  ])('accepts %s (%s)', (text) => {
    expect(isProvenFoodSite(text)).toBe(true);
  });

  it.each([
    [
      'HUD Section 202 / Multifamily 202/811 for Elderly (age 62+). Rent typically 30% of adjusted income. 29 units.',
      'senior apartments',
    ],
    ['Medicare-certified home health agency. Skilled nursing, physical therapy.', 'home health'],
    [
      'Medicare-certified hospice care provider. Comprehensive end-of-life care for terminally-ill patients.',
      'hospice',
    ],
    [
      'Federally-certified Rural Health Clinic (RHC). Primary care services in rural areas.',
      'rural clinic',
    ],
    [
      'Medicare-certified dialysis facility. Treats end-stage renal disease with hemodialysis.',
      'dialysis — trips food words via renal diet',
    ],
    [
      'Intermediate Care Facility for Developmentally Disabled - Nursing. Long-term residential care.',
      'ICF',
    ],
    [
      'Department of Veterans Affairs facility (Vet Center). Free or low-cost healthcare.',
      'VA facility',
    ],
    ['Ryan White HIV/AIDS Program (RWHAP)-funded provider.', 'Ryan White'],
    ['Federally-certified opioid treatment program. Methadone maintenance.', 'opioid treatment'],
    ['appointment', 'no evidence either way'],
    ['', 'empty'],
  ])('rejects %s (%s)', (text) => {
    expect(isProvenFoodSite(text)).toBe(false);
  });
});
