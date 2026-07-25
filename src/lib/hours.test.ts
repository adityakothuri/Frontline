import { describe, expect, it } from 'vitest';
import { closingTimeToday, isOpenNow } from './hours';

// 2026-07-20 is a Monday; times are local (no trailing Z) so getDay/getHours
// read the intended weekday and hour regardless of the runner's timezone.
const monday3pm = new Date('2026-07-20T15:00:00');
const monday6pm = new Date('2026-07-20T18:00:00');
const saturdayNoon = new Date('2026-07-25T12:00:00'); // 2026-07-25 is a Saturday

describe('isOpenNow', () => {
  it('returns true inside a matching day/time window', () => {
    expect(isOpenNow('Mon-Fri 09:00-17:00', monday3pm)).toBe(true);
  });

  it('returns false outside the time window', () => {
    expect(isOpenNow('Mon-Fri 09:00-17:00', monday6pm)).toBe(false);
  });

  it('returns false when today has no interval', () => {
    expect(isOpenNow('Sat 10:00-14:00', monday3pm)).toBe(false);
    expect(isOpenNow('Sat 10:00-14:00', saturdayNoon)).toBe(true);
  });

  it('returns null for missing or unparseable hours', () => {
    expect(isOpenNow(null, monday3pm)).toBeNull();
    expect(isOpenNow('whenever we feel like it', monday3pm)).toBeNull();
  });
});

describe('closingTimeToday', () => {
  it('formats the closing time when currently open', () => {
    expect(closingTimeToday('Mon-Fri 09:00-17:00', monday3pm)).toBe('5 PM');
  });

  it('is null when closed', () => {
    expect(closingTimeToday('Mon-Fri 09:00-17:00', monday6pm)).toBeNull();
  });
});
