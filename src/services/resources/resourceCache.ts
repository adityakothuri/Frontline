/**
 * A session-lifetime cache in front of the resource reads. Concurrent callers
 * with the same key share one in-flight request, and a result is reused for
 * `TTL_MS`. In memory only, so a relaunch never shows rows the backend has since
 * retired. Failures are never cached, so "Try again" is a real attempt.
 */

const TTL_MS = 5 * 60 * 1000;

type Entry<T> = {
  /** Present while the request is in flight; resolved callers share it. */
  inFlight: Promise<T> | null;
  value: T | null;
  storedAt: number;
};

const entries = new Map<string, Entry<unknown>>();

/** Run `fetcher` for `key`, or hand back a fresh-enough / in-flight result. */
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
      entries.delete(key);
      throw error;
    });

  entries.set(key, { inFlight, value: null, storedAt: Date.now() } as Entry<unknown>);
  return inFlight;
}

/** A fresh cached value for `key`, without fetching. */
export function peekCache<T>(key: string): T | null {
  const hit = entries.get(key) as Entry<T> | undefined;
  if (!hit || hit.value === null || Date.now() - hit.storedAt >= TTL_MS) return null;
  return hit.value;
}

/** Store a value another read already returned — a list's rows make each
 *  resource's detail page open without its own round trip. */
export function primeCache<T>(key: string, value: T): void {
  const hit = entries.get(key);
  if (hit?.inFlight) return;
  entries.set(key, { inFlight: null, value, storedAt: Date.now() });
}

/** Forget everything (test isolation). */
export function invalidateResourceCache(): void {
  entries.clear();
}
