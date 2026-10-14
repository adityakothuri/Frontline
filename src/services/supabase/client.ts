import { supabaseConfig } from './config';

/**
 * Minimal typed fetch helper for Supabase (PostgREST + Edge Functions). No
 * supabase-js: the app only needs anon-key REST reads and one function call,
 * and the SDK's auth/realtime/storage baggage would be dead weight.
 */

/** RN fetch has no timeout; without one a dead network outlives every loading state.
 *  12s rather than 8s: a cold launch stacks DNS, TLS and a cold database cache on
 *  top of the query itself, and 8s was tight enough that a first browse aborted
 *  and dropped the veteran on "Something went wrong". */
const TIMEOUT_MS = 12000;

/** The bundle shipped without EXPO_PUBLIC_SUPABASE_* — never worth a retry. */
export class NotConfiguredError extends Error {
  constructor() {
    super('Supabase is not configured');
    this.name = 'NotConfiguredError';
  }
}

export class SupabaseRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SupabaseRequestError';
    this.status = status;
  }
}

/** Backoff before each retry. The first is long enough for a radio or DNS lookup
 *  to finish waking up; the second gives a genuinely cold backend a moment more.
 *  Two entries = at most two retries. */
const RETRY_DELAYS_MS = [400, 1200];

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Override the default timeout (the AI function can be slower than reads). */
  timeoutMs?: number;
  /** Retry on a transient failure (see RETRY_DELAYS_MS). On by default — every
   *  read here is idempotent. The AI function opts out: it is expensive, and its
   *  30s timeout makes a second attempt a nearly two-minute wait. */
  retry?: boolean;
};

/**
 * Worth another attempt? Timeouts, dropped connections and 5xx are transient.
 * A 4xx is deterministic — retrying a bad key or a malformed filter just burns
 * another timeout and delays the error the caller needs to see. So is an
 * unconfigured backend: that is a property of the bundle, not of the network.
 */
function isTransient(error: unknown): boolean {
  if (error instanceof SupabaseRequestError) return error.status >= 500;
  if (error instanceof NotConfiguredError) return false;
  // AbortError (our timeout) and RN's TypeError for a failed connection.
  return error instanceof Error;
}

/**
 * The first request after a cold app launch is the one most likely to fail — the
 * radio, DNS and TLS are all warming up at once — and a single blip used to drop
 * the veteran straight onto "Something went wrong". Retrying absorbs that.
 */
export async function supabaseRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const delays = options.retry === false ? [] : RETRY_DELAYS_MS;
  for (let i = 0; ; i++) {
    try {
      return await attempt<T>(path, options);
    } catch (error) {
      if (i >= delays.length || !isTransient(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delays[i]));
    }
  }
}

async function attempt<T>(path: string, options: RequestOptions): Promise<T> {
  if (!supabaseConfig) {
    // Factories only construct Supabase-backed services when config exists.
    throw new NotConfiguredError();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);

  try {
    // Legacy anon keys are JWTs and belong on both headers; the newer
    // `sb_publishable_...` keys are NOT JWTs — sending one as a Bearer token
    // gets the request rejected, so it rides on `apikey` alone.
    const isJwtKey = supabaseConfig.anonKey.startsWith('eyJ');
    const response = await fetch(`${supabaseConfig.url}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        apikey: supabaseConfig.anonKey,
        ...(isJwtKey ? { Authorization: `Bearer ${supabaseConfig.anonKey}` } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      // PostgREST/function errors carry {message, ...}; surface it to the
      // existing error/retry UI.
      let message = `HTTP ${response.status}`;
      try {
        const payload = (await response.json()) as { message?: string; error?: string };
        message = payload.message ?? payload.error ?? message;
      } catch {
        // Non-JSON error body — keep the status message.
      }
      throw new SupabaseRequestError(message, response.status);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
