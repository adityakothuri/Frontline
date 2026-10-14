import { describe, expect, it } from 'vitest';
import {
  closingTimeToday,
  dayWindows,
  describeHours,
  formatTimeOfDay,
  isAlwaysOpen,
  isOpenNow,
  weeklyIntervals,
} from './hours';

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

describe('weeklyIntervals', () => {
  it('expands a day range into one interval per day, Sunday-indexed', () => {
    // Mon-Wed = 1, 2, 3 under Date.getDay() numbering.
    expect(weeklyIntervals('Mon-Wed 09:00-17:00')).toEqual([
      { day: 1, start: 540, end: 1020 },
      { day: 2, start: 540, end: 1020 },
      { day: 3, start: 540, end: 1020 },
    ]);
  });

  it('keeps each semicolon group separate', () => {
    expect(weeklyIntervals('Sat 10:00-14:00; Sun 12:00-16:00')).toEqual([
      { day: 6, start: 600, end: 840 },
      { day: 0, start: 720, end: 960 },
    ]);
  });

  it('wraps a day range across the end of the week', () => {
    const days = weeklyIntervals('Fri-Mon 08:00-12:00')?.map((i) => i.day);
    expect(days).toEqual([5, 6, 0, 1]);
  });

  it('is null for missing or unparseable hours', () => {
    expect(weeklyIntervals(null)).toBeNull();
    expect(weeklyIntervals('by appointment only')).toBeNull();
    // An end at or before the start is an overnight shift or a typo — neither
    // is representable, so the whole string is refused rather than guessed at.
    expect(weeklyIntervals('Mon 18:00-09:00')).toBeNull();
  });
});

describe('isAlwaysOpen', () => {
  it('recognises the 24/7 encoding ingestion emits', () => {
    expect(isAlwaysOpen('Mon-Sun 00:00-23:59')).toBe(true);
  });

  it('recognises an equivalent spelling spread over separate groups', () => {
    expect(isAlwaysOpen('Mon-Fri 00:00-23:59; Sat-Sun 00:00-23:59')).toBe(true);
  });

  it('is false when any day is uncovered or any window is partial', () => {
    expect(isAlwaysOpen('Mon-Sat 00:00-23:59')).toBe(false); // Sunday missing
    expect(isAlwaysOpen('Mon-Sun 06:00-23:59')).toBe(false); // opens late
    expect(isAlwaysOpen('Mon-Fri 09:00-17:00')).toBe(false);
  });

  it('is false rather than null when hours are unknown', () => {
    expect(isAlwaysOpen(null)).toBe(false);
    expect(isAlwaysOpen('whenever we feel like it')).toBe(false);
  });
});

describe('dayWindows', () => {
  it('collapses a lunch gap to the first opening and last closing', () => {
    expect(dayWindows('Mon 09:00-12:00; Mon 13:00-17:00')).toEqual([
      { day: 1, open: 540, close: 1020 },
    ]);
  });

  it('is empty rather than null when hours are unknown', () => {
    expect(dayWindows(null)).toEqual([]);
    expect(dayWindows('call for times')).toEqual([]);
  });
});

describe('describeHours', () => {
  it('collapses consecutive days that share a window', () => {
    expect(describeHours('Mon-Fri 08:00-16:30')).toEqual(['Mon–Fri · 8 AM – 4:30 PM']);
  });

  it('reads Monday-first, the way a posted schedule does', () => {
    expect(describeHours('Mon-Fri 09:00-17:00; Sat-Sun 10:00-14:00')).toEqual([
      'Mon–Fri · 9 AM – 5 PM',
      'Sat–Sun · 10 AM – 2 PM',
    ]);
  });

  it('breaks a run when a day differs or is missing', () => {
    expect(describeHours('Mon 09:00-17:00; Tue 10:00-18:00; Thu 09:00-17:00')).toEqual([
      'Mon · 9 AM – 5 PM',
      'Tue · 10 AM – 6 PM',
      'Thu · 9 AM – 5 PM',
    ]);
  });

  it('keeps a single-day pantry window on one line', () => {
    expect(describeHours('Sat 09:00-11:00')).toEqual(['Sat · 9 AM – 11 AM']);
  });

  it('does not wrap Sunday into the Monday run', () => {
    // Sunday sorts last in display order, so a Sun+Mon match must not merge.
    expect(describeHours('Mon-Fri 09:00-17:00; Sun 09:00-17:00')).toEqual([
      'Mon–Fri · 9 AM – 5 PM',
      'Sun · 9 AM – 5 PM',
    ]);
  });

  it('is empty when the hours are unknown', () => {
    expect(describeHours(null)).toEqual([]);
    expect(describeHours('by appointment')).toEqual([]);
  });
});

describe('formatTimeOfDay', () => {
  it('drops the minutes on the hour and keeps them otherwise', () => {
    expect(formatTimeOfDay(540)).toBe('9 AM');
    expect(formatTimeOfDay(990)).toBe('4:30 PM');
  });

  it('renders both noon and midnight as 12', () => {
    expect(formatTimeOfDay(0)).toBe('12 AM');
    expect(formatTimeOfDay(720)).toBe('12 PM');
  });
});
