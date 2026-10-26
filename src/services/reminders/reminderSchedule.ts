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
 * Turns "remind me when this opens" into the weekly triggers the OS should hold
 * and the words each one says. Pure, so it is testable; the OS layer lives in
 * `notificationScheduler`.
 *
 * Times are device-local wall-clock, matching `isOpenNow` (resources carry no
 * timezone), so a bell never disagrees with the "Open now" pill.
 */

const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/** Minutes before opening that the reminder fires. */
export type ReminderLead = 0 | 15 | 30 | 60;

/** Every lead a stored preference may carry. */
export const LEAD_OPTIONS: readonly ReminderLead[] = [30, 0, 15, 60];

export const DEFAULT_LEAD: ReminderLead = 30;

/** How long before closing the optional second reminder fires. */
const CLOSING_LEAD_MINUTES = 60;

/**
 * iOS silently discards local notifications past 64 pending, and each weekly
 * trigger holds a slot (a `Mon-Fri` resource with closing warnings costs ten).
 * Budgeted in slots, not resources, with headroom under 64.
 */
export const SLOT_BUDGET = 56;

/**
 * What the planner needs about a resource, captured when the full record was last
 * loaded, so rebuilding the schedule never waits on the network. `sourceLabel`
 * arrives pre-composed (`toReminderSnapshot`) so a notification never claims
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
 * Whether a resource can carry a reminder: not unparseable hours, not 24/7 (no
 * opening to wait for), and not `jobs` (no visiting hours).
 */
export function isRemindable(hours: string | null, category: ResourceCategory): boolean {
  if (category === 'jobs') return false;
  if (isAlwaysOpen(hours)) return false;
  return weeklyIntervals(hours) !== null;
}

/**
 * A minute-of-week resolved to a weekly trigger slot. The modulo wraps a lead
 * before Sunday midnight back to Saturday instead of a negative weekday the OS
 * silently refuses.
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
 * The words a notification says. Every body carries the source line and ends in
 * "call ahead to confirm", so a banner never claims more than the app does.
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
 * Every trigger a single reminder wants, before the budget gets a say. Openings
 * and closings are separate because under pressure closings are dropped first.
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

    // A closing warning that would land before opening is dropped, not clamped.
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
 * The whole device schedule, clamped to `SLOT_BUDGET`. Openings first, oldest
 * first, so a squeeze drops closing warnings before any reminder.
 * `droppedClosingFor` names resources that asked for a closing warning and
 * didn't get one, so the sheet can say so.
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
