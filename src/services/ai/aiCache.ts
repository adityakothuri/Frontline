import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * On-device cache for AI output that is derived purely from resource content.
 *
 * Opening a resource auto-generates a benefit summary (Haiku) and a next-step
 * plan (Opus). Without a cache, re-opening the same resource re-derives
 * identical text and spends against the edge function's hourly budget every
 * time. Resource rows change at most monthly, so this is close to free hit rate.
 *
 * Correctness comes from the key, not the clock: entries are keyed by a hash of
 * the exact inputs the prompt saw, so any change to the resource (or the need)
 * misses the cache and regenerates. The TTL is only a backstop so stale text
 * can't live on a device forever.
 */

const STORAGE_KEY = 'frontline.aiCache.v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** Keeps the blob small; entries are cheap to regenerate, so evict aggressively. */
const MAX_ENTRIES = 60;

type Entry = { at: number; value: unknown };
type Store = Record<string, Entry>;

/** FNV-1a: a short, stable, dependency-free content hash. Not cryptographic. */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Cache key for a task over the exact inputs that shaped the prompt. */
export function aiCacheKey(task: string, inputs: unknown): string {
  return `${task}:${hash(JSON.stringify(inputs))}`;
}

async function readStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    // A corrupt cache must never break a resource page — treat it as empty.
    return {};
  }
}

/** Cached value for `key`, or null when absent, expired, or unreadable. */
export async function readAiCache<T>(key: string): Promise<T | null> {
  const store = await readStore();
  const entry = store[key];
  if (!entry || Date.now() - entry.at > TTL_MS) return null;
  return entry.value as T;
}

/** Cache `value` under `key`. Failures are swallowed — this is an optimisation. */
export async function writeAiCache(key: string, value: unknown): Promise<void> {
  try {
    const store = await readStore();
    store[key] = { at: Date.now(), value };
    const keys = Object.keys(store);
    if (keys.length > MAX_ENTRIES) {
      // Drop the oldest entries back down to the cap.
      keys
        .sort((a, b) => store[a].at - store[b].at)
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((k) => delete store[k]);
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore: a failed write just means the next open regenerates.
  }
}
