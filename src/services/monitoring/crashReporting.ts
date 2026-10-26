import * as Sentry from '@sentry/react-native';

/**
 * Crash reporting via Sentry, initialised once from the root layout. Every export
 * is a no-op without EXPO_PUBLIC_SENTRY_DSN.
 *
 * Privacy shapes the config: no PII, request bodies, replay, screenshots or view
 * hierarchy — a stack trace, device/OS and release, nothing about the person.
 *
 * Env access MUST be a literal property read (Expo inlines EXPO_PUBLIC_* at build).
 */

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Records the screen a crash happened on; the root layout registers the navigation container. */
export const navigationIntegration = Sentry.reactNavigationIntegration();

/** Strip fields where a ZIP or first name could ride along, beyond what `sendDefaultPii: false` covers. */
function scrub(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  delete event.user;
  delete event.request;
  if (event.contexts) delete event.contexts.device_app_hash;
  event.breadcrumbs = event.breadcrumbs?.map((crumb) =>
    // Breadcrumb payloads carry fetch bodies and route params.
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

/**
 * Report a failed data load before the screen shows its error state. `where`
 * names the screen. Also logs to the console, since local dev has no DSN.
 */
export function reportDataError(where: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(`[${where}] data load failed:`, detail);
  captureException(error);
}

/**
 * Wraps the root component so Sentry can instrument startup. Pass-through without
 * a DSN, since wrapping without `Sentry.init` logs a misleading ordering warning.
 */
export const withCrashReporting: typeof Sentry.wrap = dsn ? Sentry.wrap : (component) => component;
