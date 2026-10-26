import { isOpenNow } from '@/lib/hours';
import { describe, expect, it } from 'vitest';
import { fromDayRanges, fromOsm, fromVaHours, parseClock } from './openingHours.ts';

/**
 * The contract these tests exist to hold: anything this module emits must be
 * understood by `src/lib/hours.ts`. That parser returns null for what it cannot
 * read, so a subtly-wrong dialect would not throw — it would silently turn every
 * row's hours into "unknown" and nobody would notice. So the important assertion
 * throughout is `isOpenNow(output, someTime) !== null`.
 */

/** A Wednesday at 10:00 local, and the same Wednesday at 22:00. */
const WED_10AM = new Date(2026, 6, 29, 10, 0);
const WED_10PM = new Date(2026, 6, 29, 22, 0);
const SUN_10AM = new Date(2026, 7, 2, 10, 0);

/** Every produced string must be parseable by the app, not merely non-empty. */
const expectParseable = (hours: string | null) => {
  expect(hours).not.toBeNull();
  expect(isOpenNow(hours as string, WED_10AM)).not.toBeNull();
};

describe('parseClock', () => {
  it.each([
    ['09:00', 540],
    ['9:00', 540],
    ['0900', 540],
    ['900AM', 540],
    ['4:30PM', 990],
    ['16:30', 990],
    ['16:30:00', 990], // HSDS sends seconds
    ['12:00AM', 0],
    ['12:00PM', 720],
    ['24:00', 1439], // end-of-day becomes 23:59
  ])('parses %s', (input, expected) => {
    expect(parseClock(input)).toBe(expected);
  });

  it.each(['', 'noon', '25:00', '09:75', 'abc'])('refuses %s', (input) => {
    expect(parseClock(input)).toBeNull();
  });
});

describe('fromVaHours', () => {
  it('collapses consecutive identical days into a range', () => {
    const out = fromVaHours({
      monday: '800AM-430PM',
      tuesday: '800AM-430PM',
      wednesday: '800AM-430PM',
      thursday: '800AM-430PM',
      friday: '800AM-430PM',
      saturday: 'Closed',
      sunday: '-',
    });
    expect(out).toBe('Mon-Fri 08:00-16:30');
    expectParseable(out);
  });

  it('keeps a differing weekend day as its own group', () => {
    const out = fromVaHours({
      monday: '9:00AM-5:00PM',
      tuesday: '9:00AM-5:00PM',
      saturday: '10:00AM-2:00PM',
    });
    expect(out).toBe('Mon-Tue 09:00-17:00; Sat 10:00-14:00');
    expectParseable(out);
  });

  it('returns null when nothing parses, rather than an empty string', () => {
    expect(fromVaHours({ monday: 'Closed', tuesday: 'call ahead' })).toBeNull();
    expect(fromVaHours(null)).toBeNull();
    expect(fromVaHours({})).toBeNull();
  });
});

describe('fromOsm', () => {
  it.each([
    ['Mo-Sa 09:30-21:00; Su 10:00-18:00', 'Mon-Sat 09:30-21:00; Sun 10:00-18:00'],
    ['Th-Su 12:00-18:00', 'Thu-Sun 12:00-18:00'],
    // ',' used as a rule separator, which appears in the wild alongside ';'
    ['Mo-Sa 09:00-20:00, Su 10:00-18:00', 'Mon-Sat 09:00-20:00; Sun 10:00-18:00'],
    // a bare range with no day prefix means every day
    ['10:00-20:00', 'Mon-Sun 10:00-20:00'],
    ['24/7', 'Mon-Sun 00:00-23:59'],
    ['Mo-Fr 08:00-24:00', 'Mon-Fri 08:00-23:59'],
    // an explicit closure drops that day
    ['Mo-Sa 10:00-18:00; Su off', 'Mon-Sat 10:00-18:00'],
    // comma day list
    ['Mo,We,Fr 09:00-17:00', 'Mon 09:00-17:00; Wed 09:00-17:00; Fri 09:00-17:00'],
    // a wrapping range
    ['Sa-Su 11:00-16:00', 'Sat-Sun 11:00-16:00'],
  ])('converts %s', (input, expected) => {
    const out = fromOsm(input);
    expect(out).toBe(expected);
    expectParseable(out);
  });

  it('widens a split day to the covering span, since one day cannot hold two ranges', () => {
    // A lunch closure cannot be expressed in the controlled format. The envelope
    // is the honest answer — it never claims closed when the shop is open.
    expect(fromOsm('Mo-Fr 09:00-12:00,13:00-17:00')).toBe('Mon-Fri 09:00-17:00');
  });

  it('refuses holiday and appointment conditionals instead of half-parsing them', () => {
    expect(fromOsm('Mo-Sa,PH 09:00-20:00; Dec 24 off')).toBeNull();
    expect(fromOsm('Mo-Fr 09:00-17:00; SH 10:00-14:00')).toBeNull();
    expect(fromOsm('by appointment')).toBeNull();
    expect(fromOsm('Apr-Oct Mo-Fr 09:00-17:00')).toBeNull();
  });

  it('refuses malformed values', () => {
    expect(fromOsm('')).toBeNull();
    expect(fromOsm(null)).toBeNull();
    expect(fromOsm('closed')).toBeNull();
    expect(fromOsm('Xx-Yy 09:00-17:00')).toBeNull();
    expect(fromOsm('Mo-Fr 9am to 5pm')).toBeNull();
    // end before start is an overnight shift or a typo; either way, refuse
    expect(fromOsm('Mo 18:00-09:00')).toBeNull();
  });

  it('produces hours the app agrees with', () => {
    const out = fromOsm('Mo-Sa 09:00-17:00; Su off') as string;
    expect(isOpenNow(out, WED_10AM)).toBe(true);
    expect(isOpenNow(out, WED_10PM)).toBe(false);
    expect(isOpenNow(out, SUN_10AM)).toBe(false);
  });
});

describe('fromDayRanges', () => {
  it('converts HSDS schedule rows, seconds and all', () => {
    const out = fromDayRanges([
      { day: 'MO', opens: '09:00:00', closes: '16:00:00' },
      { day: 'TU', opens: '09:00:00', closes: '16:00:00' },
      { day: 'WE', opens: '09:00:00', closes: '16:00:00' },
    ]);
    expect(out).toBe('Mon-Wed 09:00-16:00');
    expectParseable(out);
  });

  it('converts NTD-style full day names', () => {
    const out = fromDayRanges([
      { day: 'Monday', opens: '6:00:00', closes: '18:00:00' },
      { day: 'Saturday', opens: '8:00:00', closes: '12:00:00' },
    ]);
    expect(out).toBe('Mon 06:00-18:00; Sat 08:00-12:00');
    expectParseable(out);
  });

  it('merges duplicate days to the widest span, since a location has many services', () => {
    const out = fromDayRanges([
      { day: 'MO', opens: '09:00:00', closes: '12:00:00' },
      { day: 'MO', opens: '13:00:00', closes: '17:00:00' },
    ]);
    expect(out).toBe('Mon 09:00-17:00');
  });

  it('skips unusable rows without discarding the good ones', () => {
    const out = fromDayRanges([
      { day: 'MO', opens: '09:00:00', closes: '17:00:00' },
      { day: 'TU', opens: null, closes: '17:00:00' },
      { day: 'nonsense', opens: '09:00:00', closes: '17:00:00' },
    ]);
    expect(out).toBe('Mon 09:00-17:00');
  });

  it('returns null for an empty or wholly unusable set', () => {
    expect(fromDayRanges([])).toBeNull();
    expect(fromDayRanges([{ day: 'MO', opens: null, closes: null }])).toBeNull();
  });
});
