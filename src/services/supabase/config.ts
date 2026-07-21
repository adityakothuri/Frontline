/**
 * The one switch between offline (mock/templated) and real backend mode.
 * Both service factories read this: config absent -> mock resources + templated
 * AI; config present -> Supabase + Claude.
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
