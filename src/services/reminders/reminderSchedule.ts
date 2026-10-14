import {
  MINUTES_PER_DAY,
  dayWindows,
  formatTimeOfDay,
  isAlwaysOpen,
  weeklyIntervals,
  type DayWindow,
} from '@/lib/hours';
import type { ResourceCategory } from '@/types/resource';

/**
 * Turns "remind me when this opens" into the exact set of weekly triggers the OS
 * should hold, and the words each one says.
 *
 * Everything here is pure and takes its inputs explicitly, because this is where
 * the feature's judgment lives and it is the only part worth testing: the OS
 * layer around it (`notificationScheduler`) is untestable in vitest's node
 * environment, so anything that could be wrong belongs on this side of the line.
 *
 * Times are wall-clock, local to the device — the same simplification
 * `isOpenNow` already makes, because `resources` carries no timezone. A bell
 * that disagreed with the "Open now" pill three feet above it would be worse
 * than one that is uniformly device-local. See the Decision Log.
 */

const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/** Minutes before opening that the reminder fires. */
export type ReminderLead = 0 | 15 | 30 | 60;

/** Offered in this order — the default leads, since most people keep it. */
export const LEAD_OPTIONS: readonly ReminderLead[] = [30, 0, 15, 60];

export const DEFAULT_LEAD: ReminderLead = 30;

/** How long before closing the optional second reminder fires. */
export const CLOSING_LEAD_MINUTES = 60;

/**
 * iOS silently discards local notifications past 64 pending requests, and a
 * repeating weekly trigger costs one slot for as long as it lives. A `Mon-Fri`
 * resource with closing warnings therefore costs ten. Budget in slots rather
 * than resources, because the data is bimodal: clinics cost 5–10 while the far
 * more numerous pantries (`Sat 09:00-11:00`) cost 1–2.
 */
export const SLOT_BUDGET = 56;

/**
 * What the planner needs to know about a resource, captured when we last had the
 * full record in hand.
 *
 * It is a snapshot rather than a live read so reminders keep working cold and
 * offline — rebuilding the schedule must never wait on the network. `sourceLabel`
 * arrives pre-composed from the feature layer (via `toReminderSnapshot`) so this
 * module stays free of presentation imports and the notification can never claim
 * more certainty than the card the veteran saw.
 */
export interface ReminderSnapshot {
  name: string;
  hours: string | null;
  category: ResourceCategory;
  /** e.g. `Official VA/gov data · updated Jun 18, 2026`. */
  sourceLabel: string;
  /** ISO timestamp, so a stale snapshot is visible when debugging. */
  capturedAt: string;
}

/** What the veteran asked for. This is the persisted truth. */
export interface ReminderPreference {
  resourceId: string;
  lead: ReminderLead;
  warnBeforeClosing: boolean;
  /** ISO. Orders the budget so established reminders survive a squeeze. */
  enabledAt: string;
  snapshot: ReminderSnapshot;
}

export type ReminderKind = 'open' | 'close';

/** One OS-level weekly trigger. The derived projection, rebuilt from scratch. */
export interface PlannedNotification {
  /** Stable across rebuilds, so `applyPlan` can diff instead of repaving. */
  key: string;
  resourceId: string;
  kind: ReminderKind;
  /** 1 = Sunday … 7 = Saturday — the `expo-notifications` convention, not `getDay()`. */
  weekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
}

/**
 * Whether a resource can carry a reminder at all.
 *
 * Three exclusions, each earned: hours we can't parse (81% of live rows) have
 * nothing to schedule; a 24/7 crisis line has no opening to wait for, so a bell
 * there would be pure noise; and `jobs` has no visiting hours at all, which is
 * why `StatusPill` already hides for it.
 */
export function isRemindable(hours: string | null, category: ResourceCategory): boolean {
  if (category === 'jobs') return false;
  if (isAlwaysOpen(hours)) return false;
  return weeklyIntervals(hours) !== null;
}

/**
 * A minute-of-week resolved to the slot a weekly trigger needs.
 *
 * The modulo is load-bearing: a 60-minute lead on a place that opens Monday
 * 00:30 fires *Sunday* 23:30, and a naive subtraction would put it on a negative
 * weekday that the OS silently refuses.
 */
function slotFor(minuteOfWeek: number): { weekday: number; hour: number; minute: number } {
  const wrapped = ((minuteOfWeek % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
  const day = Math.floor(wrapped / MINUTES_PER_DAY);
  const minuteOfDay = wrapped % MINUTES_PER_DAY;
  return {
    weekday: day + 1, // getDay()'s 0=Sunday → expo's 1=Sunday
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
  };
}

/** `30` → `30 minutes`, `60` → `1 hour`. */
function leadPhrase(minutes: number): string {
  return minutes === 60 ? '1 hour' : `${minutes} minutes`;
}

/**
 * The words a notification says.
 *
 * Every body carries the source line and ends in "call ahead to confirm" — the
 * same hedge `trustWarning` gives on the card, so a lock-screen banner can never
 * claim more than the app does. When the source is stale, `sourceLabel` already
 * degrades to "may be outdated", so the warning sharpens itself with no branch
 * here. Nothing states or implies advice.
 */
function bodyFor(
  kind: ReminderKind,
  window: DayWindow,
  lead: ReminderLead,
  sourceLabel: string,
): string {
  const headline =
    kind === 'close'
      ? `Closes at ${formatTimeOfDay(window.close)}, in ${leadPhrase(CLOSING_LEAD_MINUTES)}.`
      : lead === 0
        ? `Open now until ${formatTimeOfDay(window.close)}.`
        : `Opens in ${leadPhrase(lead)}, at ${formatTimeOfDay(window.open)}.`;

  return `${headline} ${sourceLabel} — call ahead to confirm.`;
}

/**
 * Every trigger a single reminder wants, before the budget gets a say.
 *
 * Openings and closings are returned separately because the budget treats them
 * differently: under pressure the app drops the nice-to-have and keeps the
 * reason the veteran set the reminder in the first place.
 */
export function planForReminder(pref: ReminderPreference): {
  open: PlannedNotification[];
  close: PlannedNotification[];
} {
  const { snapshot, resourceId, lead } = pref;
  if (!isRemindable(snapshot.hours, snapshot.category)) return { open: [], close: [] };

  // Keyed by fire slot so two day-groups that resolve to the same moment
  // collapse instead of double-firing.
  const open = new Map<string, PlannedNotification>();
  const close = new Map<string, PlannedNotification>();

  for (const window of dayWindows(snapshot.hours)) {
    const dayStart = window.day * MINUTES_PER_DAY;

    const openAt = dayStart + window.open - lead;
    const openSlot = slotFor(openAt);
    const openKey = `${resourceId}:open:${openSlot.weekday}:${openSlot.hour}:${openSlot.minute}`;
    open.set(openKey, {
      key: openKey,
      resourceId,
      kind: 'open',
      ...openSlot,
      title: snapshot.name,
      body: bodyFor('open', window, lead, snapshot.sourceLabel),
    });

    if (!pref.warnBeforeClosing) continue;

    // A "closes in an hour" alert that would land before the doors open is a
    // lie, so that day's warning is dropped rather than clamped forward.
    if (window.close - CLOSING_LEAD_MINUTES <= window.open) continue;

    const closeAt = dayStart + window.close - CLOSING_LEAD_MINUTES;
    const closeSlot = slotFor(closeAt);
    const closeKey = `${resourceId}:close:${closeSlot.weekday}:${closeSlot.hour}:${closeSlot.minute}`;
    close.set(closeKey, {
      key: closeKey,
      resourceId,
      kind: 'close',
      ...closeSlot,
      title: snapshot.name,
      body: bodyFor('close', window, lead, snapshot.sourceLabel),
    });
  }

  return { open: [...open.values()], close: [...close.values()] };
}

/** How many of the 64 slots one reminder would consume. Used before arming. */
export function slotCost(pref: ReminderPreference): number {
  const { open, close } = planForReminder(pref);
  return open.length + close.length;
}

/**
 * The whole device schedule, clamped to what the OS will actually hold.
 *
 * Openings first, in the order they were set, so a squeeze drops the newest
 * closing warning rather than silently disarming someone's oldest reminder.
 * `droppedClosingFor` names every resource that asked for a closing warning and
 * ended up without one — whether the budget took it or the window was too short
 * — so the sheet can say so plainly instead of quietly doing less than it said.
 */
export function planAll(prefs: ReminderPreference[]): {
  planned: PlannedNotification[];
  droppedClosingFor: string[];
} {
  const ordered = [...prefs].sort((a, b) => a.enabledAt.localeCompare(b.enabledAt));

  const opens: PlannedNotification[] = [];
  const closes: PlannedNotification[] = [];
  for (const pref of ordered) {
    const { open, close } = planForReminder(pref);
    opens.push(...open);
    closes.push(...close);
  }

  const planned = [...opens, ...closes].slice(0, SLOT_BUDGET);

  const survived = new Set(planned.filter((p) => p.kind === 'close').map((p) => p.resourceId));
  const droppedClosingFor = ordered
    .filter((pref) => pref.warnBeforeClosing)
    .filter((pref) => isRemindable(pref.snapshot.hours, pref.snapshot.category))
    .map((pref) => pref.resourceId)
    .filter((id) => !survived.has(id));

  return { planned, droppedClosingFor };
}
