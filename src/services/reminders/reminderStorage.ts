import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureException } from '../monitoring';
import {
  DEFAULT_LEAD,
  LEAD_OPTIONS,
  type ReminderLead,
  type ReminderPreference,
} from './reminderSchedule';

// Deliberately not in the `sync` backup: restoring reminders onto a second
// device would double every alert.
const STORAGE_KEY = 'frontline.reminders.v1';

const isLead = (value: unknown): value is ReminderLead =>
  LEAD_OPTIONS.includes(value as ReminderLead);

/**
 * A tolerant parse: a preference missing any snapshot field is dropped, since a
 * missing `sourceLabel` would print "undefined" on the lock screen.
 */
function parsePreference(value: unknown): ReminderPreference | null {
  if (typeof value !== 'object' || value === null) return null;
  const pref = value as Partial<ReminderPreference>;
  const snapshot = pref.snapshot;

  if (typeof pref.resourceId !== 'string' || typeof pref.enabledAt !== 'string') return null;
  if (typeof snapshot !== 'object' || snapshot === null) return null;
  if (typeof snapshot.name !== 'string' || typeof snapshot.sourceLabel !== 'string') return null;
  if (typeof snapshot.category !== 'string' || typeof snapshot.capturedAt !== 'string') return null;
  if (snapshot.hours !== null && typeof snapshot.hours !== 'string') return null;

  return {
    resourceId: pref.resourceId,
    lead: isLead(pref.lead) ? pref.lead : DEFAULT_LEAD,
    warnBeforeClosing: pref.warnBeforeClosing === true,
    enabledAt: pref.enabledAt,
    snapshot: {
      name: snapshot.name,
      hours: snapshot.hours ?? null,
      category: snapshot.category,
      sourceLabel: snapshot.sourceLabel,
      capturedAt: snapshot.capturedAt,
    },
  };
}

/** Load the stored reminders, or an empty list. Never throws. */
export async function loadReminders(): Promise<ReminderPreference[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parsePreference).filter((pref): pref is ReminderPreference => pref !== null);
  } catch {
    return [];
  }
}

/** Persist the reminders. Never throws. */
export async function saveReminders(prefs: ReminderPreference[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    captureException(error);
  }
}
