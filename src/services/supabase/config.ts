/**
 * The backend config, or null when the bundle shipped without it (calls then
 * throw into the error/retry UI).
 *
 * Env access MUST be literal property reads: Expo inlines EXPO_PUBLIC_* at
 * bundle time and dynamic access (process.env[name]) yields undefined.
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
