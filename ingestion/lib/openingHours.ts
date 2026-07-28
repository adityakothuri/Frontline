/**
 * The one place that produces the app's controlled hours string.
 *
 * `src/lib/hours.ts` parses exactly one format and nothing else:
 *
 *   Mon-Fri 09:00-17:00; Sat 10:00-14:00
 *
 * semicolon-separated groups, each a day or inclusive day-range followed by a
 * 24-hour range. Day names are matched on their **first three letters**, which is
 * why OSM's two-letter `Mo` silently fails to parse — the reason this module
 * exists rather than each adapter formatting its own string.
 *
 * WHY EVERYTHING FUNNELS THROUGH ONE FILE
 *
 * Hours are the field the app is most likely to be *wrong* about in a way that
 * costs a veteran a wasted trip, and `isOpenNow()` deliberately returns null
 * ("hours unknown") for anything it cannot parse. That contract only holds if
 * every producer emits the same dialect, so the three upstream shapes we actually
 * receive all convert here:
 *
 *   fromVaHours()    VA Facilities:  { monday: "800AM-430PM", … }
 *   fromOsm()        OpenStreetMap:  "Mo-Sa 09:30-21:00; Su 10:00-18:00"
 *   fromDayRanges()  HSDS / NTD:     [{ day: 'MO', opens: '09:00:00', closes: '16:00:00' }]
 *
 * Every one of them refuses rather than guesses. An honest "unknown" beats a
 * confident wrong answer about whether a food pantry is open right now.
 */

const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Day index (0 = Monday) keyed by every spelling the upstream sources use. */
const DAY_INDEX: Record<string, number> = {
  mon: 0, monday: 0, mo: 0,
  tue: 1, tuesday: 1, tu: 1, tues: 1,
  wed: 2, wednesday: 2, we: 2,
  thu: 3, thursday: 3, th: 3, thur: 3, thurs: 3,
  fri: 4, friday: 4, fr: 4,
  sat: 5, saturday: 5, sa: 5,
  sun: 6, sunday: 6, su: 6,
};

const pad = (n: number): string => String(n).padStart(2, '0');
const toClock = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const dayIndex = (token: string): number | null => {
  const i = DAY_INDEX[token.trim().toLowerCase()];
  return i === undefined ? null : i;
};

/**
 * Midnight-to-midnight, expressed as the latest minute the app's parser accepts.
 * `24:00` and `00:00-24:00` are common upstream; `isOpenNow` compares against
 * minutes-from-midnight, so 23:59 is the honest ceiling.
 */
const ALL_DAY = '00:00-23:59';

/**
 * Per-day ranges (index 0 = Monday, null = closed/unknown) → the controlled
 * string, collapsing consecutive days that share a range. This is the single
 * assembly point; every `from*` function reduces to it.
 */
function assemble(ranges: (string | null)[]): string | null {
  const groups: string[] = [];
  let i = 0;
  while (i < ranges.length) {
    const range = ranges[i];
    if (!range) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < ranges.length && ranges[j + 1] === range) j++;
    groups.push(`${i === j ? DAY_ABBR[i] : `${DAY_ABBR[i]}-${DAY_ABBR[j]}`} ${range}`);
    i = j + 1;
  }
  return groups.length > 0 ? groups.join('; ') : null;
}

/**
 * Parse a clock token to minutes from midnight. Accepts `9`, `09:00`, `9:00`,
 * `0900`, `900AM`, `4:30PM`, `16:30:00`. Returns null for anything else.
 */
export function parseClock(raw: string): number | null {
  const t = raw.trim().toUpperCase().replace(/\s+/g, '');
  const meridiem = t.endsWith('AM') ? 'AM' : t.endsWith('PM') ? 'PM' : null;
  const body = meridiem ? t.slice(0, -2) : t;

  let hour: number;
  let minute: number;
  if (body.includes(':')) {
    // HSDS sends HH:MM:SS; seconds are never meaningful for opening times.
    const [h, m] = body.split(':');
    hour = Number(h);
    minute = Number(m);
  } else if (/^\d{3,4}$/.test(body)) {
    hour = Number(body.slice(0, body.length - 2));
    minute = Number(body.slice(-2));
  } else if (/^\d{1,2}$/.test(body)) {
    hour = Number(body);
    minute = 0;
  } else {
    return null;
  }

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return null;
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  // 24:00 means end-of-day, which the app expresses as 23:59.
  if (hour === 24 && minute === 0) return 23 * 60 + 59;
  if (hour > 23) return null;
  return hour * 60 + minute;
}

/** "800AM-430PM" / "09:00-17:00" → "08:00-16:30", or null. */
function parseRange(value: string): string | null {
  const v = value.trim();
  if (!v || /closed|^-$/i.test(v)) return null;
  if (/24\s*\/?\s*7|24\s*hours/i.test(v)) return ALL_DAY;

  const match = v.match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) return null;
  const start = parseClock(match[1]);
  const end = parseClock(match[2]);
  // A range that ends at or before it starts is either an overnight shift or a
  // typo; neither is something we can represent, so refuse.
  if (start === null || end === null || end <= start) return null;
  return `${toClock(start)}-${toClock(end)}`;
}

// ---------------------------------------------------------------------------
// VA Facilities
// ---------------------------------------------------------------------------

/**
 * VA's per-day object → controlled string.
 * `{ monday: "800AM-430PM", …, sunday: "Closed" }` → `Mon-Fri 08:00-16:30`.
 */
export function fromVaHours(hours: Record<string, string | null> | null | undefined): string | null {
  if (!hours) return null;
  const ranges: (string | null)[] = Array(7).fill(null);
  for (const [key, value] of Object.entries(hours)) {
    const i = dayIndex(key);
    if (i === null || !value) continue;
    ranges[i] = parseRange(value);
  }
  return assemble(ranges);
}

// ---------------------------------------------------------------------------
// OpenStreetMap
// ---------------------------------------------------------------------------

const OSM_DAY = /^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?$/;
const CLOCK_RANGE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;

/**
 * Anything conditional — public holidays, school holidays, month or week
 * qualifiers, "by appointment" — means the real schedule depends on context we
 * cannot represent. Refuse the whole value rather than emit a partial one that
 * reads as authoritative.
 */
const OSM_CONDITIONAL =
  /\b(PH|SH|appointment|appt|week\b|easter|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/;

/**
 * OSM `opening_hours` → controlled string.
 *
 * Measured against all 2,472 real values in the US charity/second-hand/clothing
 * extract on 2026-07-28: **2,234 (90.4%) convert**. The residue is per-day `off`
 * exceptions combined with holiday qualifiers (`Mo,Su off; Tu-Sa 10:00-16:00`)
 * and is correctly refused.
 *
 * Handles: day ranges and comma day lists, multiple ranges per day, `24/7`,
 * bare times meaning every day, `Su off`, and `;` or `,` as the rule separator.
 */
export function fromOsm(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw === '24/7' || raw === '00:00-24:00') return assemble(Array(7).fill(ALL_DAY));
  if (/^(closed|off)$/i.test(raw)) return null;

  const ranges: (string | null)[] = Array(7).fill(null);
  let matched = false;

  // ';' is OSM's rule separator. ',' is NOT split on here, because it does double
  // duty — a day list (`Mo,We,Fr 09:00-17:00`), a second range on the same days
  // (`Mo-Fr 09:00-12:00,13:00-17:00`), and sometimes a second whole rule
  // (`Mo-Sa 09:00-20:00, Su 10:00-18:00`). Splitting on it blindly turns the
  // first case into the meaningless fragments `Mo` and `We`, so the comma is
  // resolved inside `applyRule` where the surrounding tokens disambiguate it.
  for (const rule of raw.split(';')) {
    const grp = rule.trim();
    if (!grp) continue;
    // "Su off" / "Sa closed" — an explicit closure. Skip it; the day stays null.
    if (/\b(off|closed)\b/i.test(grp)) continue;
    if (OSM_CONDITIONAL.test(grp)) return null;
    const applied = applyRule(grp, ranges);
    if (applied === null) return null;
    matched = matched || applied;
  }

  return matched ? assemble(ranges) : null;
}

/**
 * Apply one OSM rule to the day ranges. Returns true if it set anything, false if
 * it was a no-op, and null if the rule could not be understood at all.
 *
 * Comma-separated tokens are walked left to right, carrying two pieces of state:
 * days seen without a time yet (a day list) and the last day set used (so a
 * trailing bare time range attaches to it).
 */
function applyRule(rule: string, ranges: (string | null)[]): boolean | null {
  let pendingDays: number[] = [];
  let lastDays: number[] = [];
  let matched = false;

  for (const token of rule.split(',')) {
    const t = token.trim();
    if (!t) continue;

    const split = t.match(/^([A-Za-z]{2}(?:-[A-Za-z]{2})?)\s+(.+)$/);
    if (split) {
      const days = expandDays(split[1]);
      if (days === null) return null;
      const all = [...pendingDays, ...days];
      pendingDays = [];
      lastDays = all;
      if (!applyTime(split[2], all, ranges)) return null;
      matched = true;
      continue;
    }

    // Day-only token: part of a list whose time comes later ("Mo," in "Mo,We,Fr 9-5").
    if (OSM_DAY.test(t)) {
      const days = expandDays(t);
      if (days === null) return null;
      pendingDays.push(...days);
      continue;
    }

    // Time-only token: either a second range for the days we just used, or — when
    // no day has been named at all — a schedule that applies every day.
    if (CLOCK_RANGE.test(t) || /24\s*\/?\s*7/i.test(t)) {
      const target = lastDays.length > 0 ? lastDays : [0, 1, 2, 3, 4, 5, 6];
      lastDays = target;
      if (!applyTime(t, target, ranges)) return null;
      matched = true;
      continue;
    }

    return null;
  }

  // A trailing day list with no time is not a schedule.
  return pendingDays.length > 0 && !matched ? null : matched;
}

/** "Mo" or "Mo-Fr" → day indices, wrapping across Sunday. */
function expandDays(spec: string): number[] | null {
  if (!OSM_DAY.test(spec)) return null;
  const [from, to] = spec.split('-');
  const start = dayIndex(from);
  const end = to === undefined ? start : dayIndex(to);
  if (start === null || end === null) return null;
  const days: number[] = [];
  for (let d = start, guard = 0; guard <= 7; d = (d + 1) % 7, guard++) {
    days.push(d);
    if (d === end) break;
  }
  return days;
}

function applyTime(time: string, days: number[], ranges: (string | null)[]): boolean {
  const parsed = parseRange(time.trim());
  if (!parsed) return false;
  for (const d of days) {
    // Two ranges on one day (a lunch closure) cannot be expressed in the
    // controlled format, so the covering span wins — it never claims closed while
    // the place is open.
    ranges[d] = ranges[d] === null ? parsed : widen(ranges[d], parsed);
  }
  return true;
}

/** Two ranges on the same day → the span that covers both. */
function widen(a: string, b: string): string {
  const [aStart, aEnd] = a.split('-');
  const [bStart, bEnd] = b.split('-');
  const start = Math.min(parseClock(aStart) ?? 0, parseClock(bStart) ?? 0);
  const end = Math.max(parseClock(aEnd) ?? 0, parseClock(bEnd) ?? 0);
  return `${toClock(start)}-${toClock(end)}`;
}

// ---------------------------------------------------------------------------
// HSDS schedules / NTD service schedules / scraped day+time tables
// ---------------------------------------------------------------------------

export interface DayRange {
  /** Any spelling this module knows: 'MO', 'Mon', 'monday', 'Tuesday'. */
  day: string;
  /** Any clock token `parseClock` accepts, incl. HSDS `09:00:00`. */
  opens: string | null | undefined;
  closes: string | null | undefined;
}

/**
 * Day+time pairs → controlled string. Used for Feeding America's HSDS
 * `schedules` table (`byday` / `opens_at` / `closes_at`), the FTA NTD
 * demand-response service schedules (`day_name` / `svc_begin_time` /
 * `svc_end_time`), and the scraped state CVSO tables.
 *
 * Rows for the same day are merged to the widest span rather than dropped, since
 * a location legitimately appears once per service.
 */
export function fromDayRanges(entries: DayRange[]): string | null {
  const ranges: (string | null)[] = Array(7).fill(null);
  for (const entry of entries) {
    const i = dayIndex(entry.day ?? '');
    if (i === null || !entry.opens || !entry.closes) continue;
    const parsed = parseRange(`${entry.opens}-${entry.closes}`);
    if (!parsed) continue;
    ranges[i] = ranges[i] === null ? parsed : widen(ranges[i], parsed);
  }
  return assemble(ranges);
}
