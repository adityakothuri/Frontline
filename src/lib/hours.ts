/**
 * Parsing for the controlled hours format ingestion writes:
 *   `Mon-Fri 09:00-17:00; Sat 10:00-14:00`
 * Anything not confidently parsed is `null` (unknown) rather than a guess.
 */

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const MINUTES_PER_DAY = 24 * 60;

/** One contiguous window a resource is open. */
export interface OpenInterval {
  /** 0 = Sunday … 6 = Saturday, matching `Date.getDay()`. */
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

/** Every window the resource is open during a week, or `null` when unknown. The single parse path. */
export function weeklyIntervals(hours: string | null): OpenInterval[] | null {
  if (!hours) return null;

  const intervals: OpenInterval[] = [];

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
  const intervals = weeklyIntervals(hours);
  if (!intervals) return null;

  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  return intervals.some(
    (interval) => interval.day === day && minutes >= interval.start && minutes < interval.end,
  );
}

/** Minutes from midnight as a friendly clock time: `540` → `9 AM`, `990` → `4:30 PM`. */
export function formatTimeOfDay(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** The one opening and closing that matter on a given day. */
export interface DayWindow {
  /** 0 = Sunday … 6 = Saturday. */
  day: number;
  open: number;
  close: number;
}

/** A week collapsed to one window per day: earliest opening, latest closing (lunch gaps ignored). */
export function dayWindows(hours: string | null): DayWindow[] {
  const intervals = weeklyIntervals(hours);
  if (!intervals) return [];

  const byDay = new Map<number, DayWindow>();
  for (const interval of intervals) {
    const existing = byDay.get(interval.day);
    if (!existing) {
      byDay.set(interval.day, { day: interval.day, open: interval.start, close: interval.end });
      continue;
    }
    existing.open = Math.min(existing.open, interval.start);
    existing.close = Math.max(existing.close, interval.end);
  }

  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

/** Monday-first display order, which is how a posted schedule reads. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Opening hours as readable lines, `['Mon–Fri · 8 AM – 4:30 PM']`, with
 * consecutive matching days collapsed. Empty when the hours are unknown.
 */
export function describeHours(hours: string | null): string[] {
  const windows = dayWindows(hours);
  if (windows.length === 0) return [];

  const byDay = new Map(windows.map((w) => [w.day, w]));
  const lines: string[] = [];
  let run: { first: number; last: number; open: number; close: number } | null = null;

  const flush = () => {
    if (!run) return;
    const days =
      run.first === run.last
        ? DAY_LABEL[run.first]
        : `${DAY_LABEL[run.first]}–${DAY_LABEL[run.last]}`;
    lines.push(`${days} · ${formatTimeOfDay(run.open)} – ${formatTimeOfDay(run.close)}`);
    run = null;
  };

  for (const day of DISPLAY_ORDER) {
    const window = byDay.get(day);
    if (!window) {
      flush();
      continue;
    }
    if (run && run.open === window.open && run.close === window.close) {
      run.last = day;
      continue;
    }
    flush();
    run = { first: day, last: day, open: window.open, close: window.close };
  }
  flush();

  return lines;
}

/** True when open every hour of every day (ingestion's `Mon-Sun 00:00-23:59`), checked structurally. */
export function isAlwaysOpen(hours: string | null): boolean {
  const intervals = weeklyIntervals(hours);
  if (!intervals) return false;

  return DAYS.every((_, day) =>
    intervals.some(
      (interval) =>
        interval.day === day && interval.start === 0 && interval.end >= MINUTES_PER_DAY - 1,
    ),
  );
}
