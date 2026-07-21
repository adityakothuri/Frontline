import { supabaseConfig } from './config';

/**
 * Minimal typed fetch helper for Supabase (PostgREST + Edge Functions). No
 * supabase-js: the app only needs anon-key REST reads and one function call,
 * and the SDK's auth/realtime/storage baggage would be dead weight.
 */

/** RN fetch has no timeout; without one a dead network outlives every loading state. */
const TIMEOUT_MS = 8000;

export class SupabaseRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SupabaseRequestError';
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Override the default timeout (the AI function can be slower than reads). */
  timeoutMs?: number;
};

export async function supabaseRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!supabaseConfig) {
    // Factories only construct Supabase-backed services when config exists.
    throw new Error('Supabase is not configured');
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
