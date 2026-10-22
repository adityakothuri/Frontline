import { NotConfiguredError, SupabaseRequestError } from '@/services/supabase/client';

/**
 * What the chat says when a turn fails, in the veteran's register.
 *
 * Separate from `describeDataError` (in `ErrorState.tsx`, which pulls in
 * React Native) because a failed chat turn is not a failed screen: the
 * conversation is still there, and the line under the last bubble has to say
 * whether to wait, shorten, or retry. Pure, so it is tested.
 */
export function chatErrorCopy(error: unknown): string {
  if (error instanceof SupabaseRequestError) {
    if (error.status === 429) return 'Frontline is busy right now. Give it a minute and try again.';
    if (error.status === 413) return "That's too much text for one message. Try a shorter one.";
    return "Couldn't get an answer just now.";
  }
  if (error instanceof NotConfiguredError) {
    return "Frontline can't reach its service. Check your connection and try again.";
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'This is taking too long. Check your signal and try again.';
    }
    if (error instanceof TypeError) {
      return "Frontline can't reach its service. Check your connection and try again.";
    }
  }
  return "Couldn't get an answer just now.";
}
