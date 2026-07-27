import * as Sentry from '@sentry/react-native';

/**
 * Crash reporting — real Sentry, initialised once from the root layout.
 *
 * Gated on EXPO_PUBLIC_SENTRY_DSN exactly like `supabaseConfig`: with no DSN
 * (local dev, a fork, a build that opts out) every export here is a no-op
 * rather than a crash, so the app never depends on monitoring being wired up.
 *
 * Privacy is the constraint that shapes the config. Frontline serves veterans
 * and shows benefit, housing, and crisis screens, so this deliberately sends
 * the *least* it can and still be useful: no PII, no request bodies, no
 * session replay, no screenshots, no view hierarchy. What Sentry gets is a
 * stack trace, the device/OS, and the release — enough to fix a crash and
 * nothing that describes the person who hit it.
 *
 * Env access MUST be a literal property read — Expo inlines EXPO_PUBLIC_* at
 * bundle time and dynamic access (process.env[name]) silently yields undefined.
 */

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** True when a DSN is configured and crashes will actually be reported. */
export const crashReportingEnabled = Boolean(dsn);

/**
 * Records which screen the veteran was on when a crash happened — the single
 * most useful piece of context for reproducing one. expo-router is React
 * Navigation underneath, so this is the matching integration; the root layout
 * hands it the container ref once navigation is mounted.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration();

/**
 * Strip anything that could carry personal data before an event leaves the
 * device. `sendDefaultPii: false` already covers IP and user identity; this is
 * the belt-and-braces pass for fields Sentry populates from the network and
 * navigation layers, where a ZIP or first name could otherwise ride along.
 */
function scrub(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  delete event.user;
  delete event.request;
  if (event.contexts) delete event.contexts.device_app_hash;
  event.breadcrumbs = event.breadcrumbs?.map((crumb) =>
    // Breadcrumb payloads carry fetch bodies and route params; the category and
    // message alone are enough to reconstruct what the veteran was doing.
    crumb.data ? { ...crumb, data: undefined } : crumb,
  );
  return event;
}

/** Start crash reporting. Safe to call when no DSN is configured. */
export function initCrashReporting(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    // A crash-reporting sample of every event, but only a slice of performance
    // traces — traces are the expensive, least useful half for this app.
    tracesSampleRate: 0.1,
    attachStacktrace: true,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,
    beforeSend: scrub,
    integrations: (defaults) => [...defaults, navigationIntegration],
  });
}

/** Report a caught error. No-op when crash reporting is not configured. */
export function captureException(error: unknown): void {
  if (!dsn) return;
  Sentry.captureException(error);
}

/** Wraps the root component so Sentry can instrument navigation and startup. */
export const withCrashReporting = Sentry.wrap;
