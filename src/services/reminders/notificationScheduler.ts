import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PlannedNotification } from './reminderSchedule';

/**
 * The only module that talks to the OS scheduler.
 *
 * Everything here is a thin, failure-swallowing wrapper: the planning decisions
 * live in `reminderSchedule`, which vitest can actually run. Every call is
 * wrapped because a rejected OS promise must degrade to "no reminder" rather
 * than take down the render that triggered it — the same never-throw contract
 * `savedStorage` keeps.
 */

/** Android needs a channel before it will ask for permission at all. */
const CHANNEL_ID = 'frontline-hours';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** Where a tapped notification wants to go. */
export const RESOURCE_ID_KEY = 'resourceId';

let configured = false;

/**
 * Register the foreground presentation rules and the Android channel.
 *
 * No badge: a badge implies an unread count the app does not maintain, and a
 * number stuck on the icon that nothing clears is its own small betrayal.
 */
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

/**
 * Ask, once, at the moment the veteran taps a bell — never at launch. Same
 * posture the app already takes with location.
 */
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
    // An unreadable schedule is treated as empty: `applyPlan` will then try to
    // schedule everything, and the OS de-duplicates nothing — which is why the
    // catch matters. See the note in `applyPlan`.
  }
  return pending;
}

/**
 * Make the device's schedule match the plan.
 *
 * A diff rather than a cancel-all-and-repave: rescheduling every trigger on
 * every foreground would reset trigger state and risks dropping one that was
 * about to fire. Keys are stable across rebuilds precisely so this can be cheap.
 */
export async function applyPlan(planned: PlannedNotification[]): Promise<void> {
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
 * The resource a tapped notification was about, when that tap is what launched
 * the app. Read once on mount — a cold start has no listener registered yet, so
 * without this the tap opens the app and then loses where it was going.
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

/** Drop every scheduled reminder. Used when the last reminder is turned off. */
export async function cancelAll(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing to do — the next `applyPlan` reconciles.
  }
}
