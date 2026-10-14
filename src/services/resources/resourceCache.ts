/**
 * A session-lifetime cache in front of the resource reads.
 *
 * Discover and Map open on the *same* browse — `listResources(undefined, zip,
 * radius)` — so a veteran who taps between the two tabs used to pay for the
 * identical query twice, and again every time they came back. Two jobs here:
 *
 *   * **Dedup.** Concurrent callers with the same key share one in-flight
 *     promise, so the two tabs mounting together issue one request.
 *   * **Reuse.** A resolved result is served for `TTL_MS`, so returning to a tab
 *     is instant and a cold launch does not re-query what it just fetched.
 *
 * In memory only, and deliberately so: resource data carries a "last checked"
 * date a veteran is asked to trust, and persisting it across launches would mean
 * showing rows the backend may since have retired. A relaunch starts clean.
 *
 * Failures are never cached — an error must stay retryable.
 */

/** Long enough to cover moving around the app, short enough that a session
 *  doesn't go stale. Retry always bypasses this (see `invalidate`). */
const TTL_MS = 5 * 60 * 1000;

type Entry<T> = {
  /** Present while the request is in flight; resolved callers share it. */
  inFlight: Promise<T> | null;
  value: T | null;
  storedAt: number;
};

const entries = new Map<string, Entry<unknown>>();

/**
 * Run `fetcher` for `key`, or hand back a fresh-enough / in-flight result.
 */
export function cachedRead<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = entries.get(key) as Entry<T> | undefined;
  if (hit) {
    if (hit.inFlight) return hit.inFlight;
    if (hit.value !== null && Date.now() - hit.storedAt < TTL_MS) return Promise.resolve(hit.value);
  }

  const inFlight = fetcher()
    .then((value) => {
      entries.set(key, { inFlight: null, value, storedAt: Date.now() });
      return value;
    })
    .catch((error) => {
      // Drop the entry entirely rather than caching the failure, so the next
      // caller — usually the veteran tapping "Try again" — gets a real attempt.
      entries.delete(key);
      throw error;
    });

  entries.set(key, { inFlight, value: null, storedAt: Date.now() } as Entry<unknown>);
  return inFlight;
}

/** Forget everything. Used by an explicit retry, where the veteran is asking for
 *  a fresh look and a cached result would make the button appear to do nothing. */
export function invalidateResourceCache(): void {
  entries.clear();
}
