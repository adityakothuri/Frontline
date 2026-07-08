/**
 * Best-effort "open now" from a resource's `hours` string.
 *
 * Understands the controlled format used by our seed data:
 *   `Mon-Fri 09:00-17:00; Sat 10:00-14:00`
 * - semicolon-separated groups
 * - each group: a day or day-range (Mon, Tue … Sun) then a 24h time range
 *
 * Anything it can't confidently parse returns `null` (unknown) rather than a
 * misleading guess — the UI shows "hours unknown" in that case.
 */

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

interface Interval {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  /** minutes from midnight */
  start: number;
  end: number;
}

const dayIndex = (token: string): number | null => {
  const i = DAYS.indexOf(token.trim().toLowerCase().slice(0, 3) as (typeof DAYS)[number]);
  return i === -1 ? null : i;
};

const parseTime = (token: string): number | null => {
  const match = token.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const parseDayRange = (token: string): number[] | null => {
  const parts = token.split('-');
  if (parts.length === 1) {
    const only = dayIndex(parts[0]);
    return only === null ? null : [only];
  }
  if (parts.length !== 2) return null;

  const from = dayIndex(parts[0]);
  const to = dayIndex(parts[1]);
  if (from === null || to === null) return null;

  const days: number[] = [];
  for (let d = from; ; d = (d + 1) % 7) {
    days.push(d);
    if (d === to) break;
    if (days.length > 7) return null; // safety
  }
  return days;
};

function parseHours(hours: string): Interval[] | null {
  const intervals: Interval[] = [];

  for (const group of hours.split(';')) {
    const trimmed = group.trim();
    if (!trimmed) continue;

    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace === -1) return null;

    const dayToken = trimmed.slice(0, firstSpace);
    const timeToken = trimmed.slice(firstSpace + 1);

    const days = parseDayRange(dayToken);
    const [startToken, endToken] = timeToken.split('-');
    if (!days || !startToken || !endToken) return null;

    const start = parseTime(startToken);
    const end = parseTime(endToken);
    if (start === null || end === null || end <= start) return null;

    for (const day of days) {
      intervals.push({ day, start, end });
    }
  }

  return intervals.length > 0 ? intervals : null;
}

/**
 * Returns true/false if hours are parseable, or `null` when unknown.
 * `now` is injectable for testing.
 */
export function isOpenNow(hours: string | null, now: Date = new Date()): boolean | null {
  if (!hours) return null;

  const intervals = parseHours(hours);
  if (!intervals) return null;

  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  return intervals.some(
    (interval) => interval.day === day && minutes >= interval.start && minutes < interval.end,
  );
}
