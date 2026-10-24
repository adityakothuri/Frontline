import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useSaved } from '../saved';
import { loadReminders, saveReminders } from './reminderStorage';
import {
  SLOT_BUDGET,
  planAll,
  slotCost,
  type ReminderLead,
  type ReminderPreference,
  type ReminderSnapshot,
} from './reminderSchedule';
import {
  addResponseListener,
  applyPlan,
  configureNotifications,
  getInitialResourceId,
  getPermissionState,
  requestPermission as requestOsPermission,
  type PermissionState,
} from './notificationScheduler';

/** What the veteran picked in the sheet, before we stamp the rest on. */
interface ReminderChoice {
  lead: ReminderLead;
  warnBeforeClosing: boolean;
}

interface ReminderSnapshotUpdate {
  resourceId: string;
  snapshot: ReminderSnapshot;
}

interface RemindersContextValue {
  /** False until the stored reminders have been read on launch. */
  isHydrated: boolean;
  permission: PermissionState;
  isReminded: (resourceId: string) => boolean;
  getPreference: (resourceId: string) => ReminderPreference | null;
  /** How many resources have a reminder armed. */
  reminderCount: number;
  /** Slots the OS can still hold. See `SLOT_BUDGET`. */
  slotsRemaining: number;
  /** Resources that asked for a closing warning and did not get one. */
  droppedClosingFor: string[];
  requestPermission: () => Promise<PermissionState>;
  /** Arms or updates a reminder. Saves the resource as a side effect. */
  setReminder: (resourceId: string, snapshot: ReminderSnapshot, choice: ReminderChoice) => void;
  clearReminder: (resourceId: string) => void;
  /** Feed fresh resource data in wherever a full record is already loaded. */
  refreshSnapshots: (updates: ReminderSnapshotUpdate[]) => void;
}

const RemindersContext = createContext<RemindersContextValue | null>(null);

export function RemindersProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<ReminderPreference[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [droppedClosingFor, setDroppedClosingFor] = useState<string[]>([]);
  const { isSaved, toggleSave } = useSaved();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    configureNotifications();
    loadReminders()
      .then((stored) => {
        if (!active) return;
        setPrefs(stored);
      })
      .catch(() => {
        // Only guards `isHydrated`, which must never stay false.
      })
      .finally(() => {
        if (active) setIsHydrated(true);
      });
    getPermissionState().then((state) => {
      if (active) setPermission(state);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) saveReminders(prefs);
  }, [prefs, isHydrated]);

  // The OS schedule is a projection of `prefs`, rebuilt whenever they change.
  // A resource that stopped being remindable simply falls out of the plan.
  useEffect(() => {
    if (!isHydrated || permission !== 'granted') return;
    const { planned, droppedClosingFor: dropped } = planAll(prefs);
    setDroppedClosingFor(dropped);
    applyPlan(planned);
  }, [prefs, isHydrated, permission]);

  // Permission can change in Settings while the app is backgrounded.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      getPermissionState().then(setPermission);
    });
    return () => subscription.remove();
  }, []);

  // A tapped reminder opens its resource. A tap that launched the app arrives
  // before any listener exists, hence the separate cold-start read.
  useEffect(() => {
    let active = true;
    const open = (resourceId: string) => {
      if (active) router.push(`/resource/${resourceId}`);
    };
    getInitialResourceId().then((id) => {
      if (id) open(id);
    });
    const unsubscribe = addResponseListener(open);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  const slotsUsed = useMemo(
    () => prefs.reduce((total, pref) => total + slotCost(pref), 0),
    [prefs],
  );

  const isReminded = useCallback(
    (resourceId: string) => prefs.some((pref) => pref.resourceId === resourceId),
    [prefs],
  );

  const getPreference = useCallback(
    (resourceId: string) => prefs.find((pref) => pref.resourceId === resourceId) ?? null,
    [prefs],
  );

  const setReminder = useCallback(
    (resourceId: string, snapshot: ReminderSnapshot, choice: ReminderChoice) => {
      // Arming implies saving: the Saved tab is where every bell can be turned off.
      if (!isSaved(resourceId)) toggleSave(resourceId);

      setPrefs((prev) => {
        const existing = prev.find((pref) => pref.resourceId === resourceId);
        const next: ReminderPreference = {
          resourceId,
          lead: choice.lead,
          warnBeforeClosing: choice.warnBeforeClosing,
          // Editing keeps its place in the budget queue.
          enabledAt: existing?.enabledAt ?? new Date().toISOString(),
          snapshot,
        };
        return existing
          ? prev.map((pref) => (pref.resourceId === resourceId ? next : pref))
          : [...prev, next];
      });
    },
    [isSaved, toggleSave],
  );

  const clearReminder = useCallback((resourceId: string) => {
    setPrefs((prev) => prev.filter((pref) => pref.resourceId !== resourceId));
  }, []);

  const refreshSnapshots = useCallback((updates: ReminderSnapshotUpdate[]) => {
    if (updates.length === 0) return;
    const byId = new Map(updates.map((update) => [update.resourceId, update.snapshot]));

    setPrefs((prev) => {
      let changed = false;
      const next = prev.map((pref) => {
        const snapshot = byId.get(pref.resourceId);
        if (!snapshot) return pref;
        // Compare only the fields that drive the schedule and copy, or every
        // Saved-tab render would re-persist and re-plan.
        const current = pref.snapshot;
        if (
          current.hours === snapshot.hours &&
          current.name === snapshot.name &&
          current.sourceLabel === snapshot.sourceLabel &&
          current.category === snapshot.category
        ) {
          return pref;
        }
        changed = true;
        return { ...pref, snapshot };
      });
      return changed ? next : prev;
    });
  }, []);

  const requestPermission = useCallback(async () => {
    const state = await requestOsPermission();
    setPermission(state);
    return state;
  }, []);

  const value = useMemo(
    () => ({
      isHydrated,
      permission,
      isReminded,
      getPreference,
      reminderCount: prefs.length,
      slotsRemaining: Math.max(0, SLOT_BUDGET - slotsUsed),
      droppedClosingFor,
      requestPermission,
      setReminder,
      clearReminder,
      refreshSnapshots,
    }),
    [
      isHydrated,
      permission,
      isReminded,
      getPreference,
      prefs.length,
      slotsUsed,
      droppedClosingFor,
      requestPermission,
      setReminder,
      clearReminder,
      refreshSnapshots,
    ],
  );

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

/** Access the reminder list. Must be used within a RemindersProvider. */
export function useReminders(): RemindersContextValue {
  const context = useContext(RemindersContext);
  if (!context) {
    throw new Error('useReminders must be used within a RemindersProvider');
  }
  return context;
}
