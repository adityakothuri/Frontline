import { supabaseConfig } from './config';

/**
 * Minimal typed fetch helper for Supabase (PostgREST + Edge Functions). No
 * supabase-js: the app only needs anon-key REST calls, and the SDK's
 * auth/realtime/storage would be dead weight.
 */

/** RN fetch has no timeout; without one a dead network outlives every loading state. */
const TIMEOUT_MS = 8000;

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

/** Backoff before the one retry, long enough for a waking radio or DNS lookup. */
const RETRY_DELAYS_MS = [400];

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Override the default timeout (the AI function can be slower than reads). */
  timeoutMs?: number;
  /** Retry once on a transient failure. On by default (reads are idempotent);
   *  the AI function opts out because of its cost and long timeout. */
  retry?: boolean;
};

/** Timeouts, dropped connections and 5xx are transient; a 4xx or a missing config is not. */
function isTransient(error: unknown): boolean {
  if (error instanceof SupabaseRequestError) return error.status >= 500;
  if (error instanceof NotConfiguredError) return false;
  // AbortError (our timeout) and RN's TypeError for a failed connection.
  return error instanceof Error;
}

/** A typed Supabase request, retried once on a transient failure (common on cold launch). */
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
