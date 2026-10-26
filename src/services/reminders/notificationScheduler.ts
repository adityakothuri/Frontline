import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PlannedNotification } from './reminderSchedule';

/**
 * The only module that talks to the OS scheduler. Thin, never-throwing wrappers:
 * a rejected OS promise degrades to "no reminder". Planning lives in
 * `reminderSchedule`, where vitest can run it.
 */

/** Android needs a channel before it will ask for permission at all. */
const CHANNEL_ID = 'frontline-hours';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** Where a tapped notification wants to go. */
const RESOURCE_ID_KEY = 'resourceId';

let configured = false;

/** Register the foreground presentation rules and the Android channel. No
 *  badge: the app keeps no unread count to clear it with. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Opening hours',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch {
      // A missing channel costs delivery on Android, not correctness elsewhere.
    }
  }
}

const toState = (status: Notifications.PermissionStatus): PermissionState =>
  status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return toState(status);
  } catch {
    return 'undetermined';
  }
}

/** Ask when the veteran taps a bell, never at launch. */
export async function requestPermission(): Promise<PermissionState> {
  try {
    await configureNotifications();
    const { status } = await Notifications.requestPermissionsAsync();
    return toState(status);
  } catch {
    return 'denied';
  }
}

/** The plan keys currently pending on the device, by notification identifier. */
async function pendingByKey(): Promise<Map<string, string>> {
  const pending = new Map<string, string>();
  try {
    for (const request of await Notifications.getAllScheduledNotificationsAsync()) {
      const key = request.content.data?.key;
      if (typeof key === 'string') pending.set(key, request.identifier);
    }
  } catch {
    // An unreadable schedule is treated as empty.
  }
  return pending;
}

let applying: Promise<void> | null = null;
let queued: PlannedNotification[] | null = null;

/**
 * Make the device's schedule match the plan.
 *
 * Serialized: two diffs running at once would both see a key as missing and
 * schedule it twice. A call made mid-apply queues, and only the latest queued
 * plan runs next.
 */
export function applyPlan(planned: PlannedNotification[]): Promise<void> {
  queued = planned;
  if (!applying) {
    applying = (async () => {
      try {
        while (queued) {
          const next = queued;
          queued = null;
          await diffSchedule(next);
        }
      } finally {
        applying = null;
      }
    })();
  }
  return applying;
}

/**
 * A diff rather than cancel-all-and-repave, which would reset trigger state and
 * risk dropping one about to fire. Keys are stable across rebuilds for this.
 */
async function diffSchedule(planned: PlannedNotification[]): Promise<void> {
  const pending = await pendingByKey();
  const wanted = new Set(planned.map((p) => p.key));

  for (const [key, identifier] of pending) {
    if (wanted.has(key)) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch {
      // Already gone, or the OS refused — either way the next sync retries.
    }
  }

  for (const plan of planned) {
    if (pending.has(plan.key)) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: plan.title,
          body: plan.body,
          data: { key: plan.key, [RESOURCE_ID_KEY]: plan.resourceId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: plan.weekday,
          hour: plan.hour,
          minute: plan.minute,
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        },
      });
    } catch {
      // One trigger the OS wouldn't take must not cost the rest of the plan.
    }
  }
}

const resourceIdFrom = (response: Notifications.NotificationResponse | null): string | null => {
  const id = response?.notification.request.content.data?.[RESOURCE_ID_KEY];
  return typeof id === 'string' ? id : null;
};

/**
 * The resource a tapped notification was about, when that tap launched the app.
 * A cold start has no listener registered yet to receive it.
 */
export async function getInitialResourceId(): Promise<string | null> {
  try {
    return resourceIdFrom(await Notifications.getLastNotificationResponseAsync());
  } catch {
    return null;
  }
}

/** Taps while the app is already running. Returns its own unsubscribe. */
export function addResponseListener(onResource: (resourceId: string) => void): () => void {
  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = resourceIdFrom(response);
      if (id) onResource(id);
    });
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}
