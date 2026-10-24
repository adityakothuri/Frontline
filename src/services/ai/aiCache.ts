import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * On-device cache for the AI output a resource page fires automatically
 * (summary, plan), so re-opening a resource doesn't spend the edge function's
 * hourly budget re-deriving identical text.
 *
 * Correctness comes from the key, not the clock: entries are keyed by a hash of
 * the exact prompt inputs, so any change to the resource or need misses. The TTL
 * is only a backstop.
 */

const STORAGE_KEY = 'frontline.aiCache.v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
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
    return {};
  }
}

// Read from disk once and shared, so the summary and plan writes that land
// together both mutate the same store instead of one overwriting the other.
let storePromise: Promise<Store> | null = null;
const loadStore = (): Promise<Store> => (storePromise ??= readStore());

let persisting: Promise<void> = Promise.resolve();

/** Cached value for `key`, or null when absent or expired. Callers validate its shape. */
export async function readAiCache(key: string): Promise<unknown> {
  const entry = (await loadStore())[key];
  if (!entry || Date.now() - entry.at > TTL_MS) return null;
  return entry.value;
}

/** Cache `value` under `key`. Failures are swallowed — this is an optimisation. */
export async function writeAiCache(key: string, value: unknown): Promise<void> {
  const store = await loadStore();
  store[key] = { at: Date.now(), value };
  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => store[a].at - store[b].at)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete store[k]);
  }
  // Chained, and serialized at write time, so the last write always carries
  // every entry.
  persisting = persisting.then(() =>
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store)).catch(() => {}),
  );
  await persisting;
}
