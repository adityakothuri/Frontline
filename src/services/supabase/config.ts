/**
 * Whether the real backend is configured. Everything is real: resources, ratings,
 * and AI all require Supabase. Without config, those calls throw and the UI shows
 * an error/retry state — there is no simulated data or templated AI anywhere.
 *
 * Env access MUST be literal property reads — Expo inlines EXPO_PUBLIC_* at
 * bundle time and dynamic access (process.env[name]) silently yields undefined.
 */

export interface SupabaseConfig {
  /** Project URL without a trailing slash. */
  url: string;
  /** anon/publishable key — read-only by RLS, safe in the client bundle. */
  anonKey: string;
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfig: SupabaseConfig | null =
  url && anonKey ? { url: url.replace(/\/+$/, ''), anonKey } : null;
