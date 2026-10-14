import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LEAD,
  LEAD_OPTIONS,
  type ReminderLead,
  type ReminderPreference,
} from './reminderSchedule';

// The one versioned key for the on-device reminder list. Reminders are
// deliberately *not* in the `sync` backup: a reminder is a promise this phone
// made about this phone's clock, and restoring one onto a second device would
// quietly double every alert. See the Decision Log.
const STORAGE_KEY = 'frontline.reminders.v1';

const isLead = (value: unknown): value is ReminderLead =>
  LEAD_OPTIONS.includes(value as ReminderLead);

/**
 * A tolerant parse: anything malformed is dropped rather than thrown over.
 *
 * The snapshot fields are the risk here — they were written by an older build
 * that may not have had all of them, and a missing `sourceLabel` would put the
 * string `undefined` on a veteran's lock screen where the trust line belongs.
 * So every field is checked, and a preference missing any of them is discarded;
 * the reminder is cheap to set again, and a wrong one is not.
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
    // An unrecognised lead falls back rather than disqualifying the reminder —
    // the veteran still gets told, just at the default distance.
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

/** Persist the reminders. */
export async function saveReminders(prefs: ReminderPreference[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
