import { useCallback, useEffect, useRef, useState } from 'react';
import { reportDataError } from '@/services/monitoring';

export type AiGuidance<T> = {
  /** The generated content, or `null` while it's still being generated. */
  data: T | null;
  failed: boolean;
  /** Re-run the call after a failure. */
  retry: () => void;
};

/**
 * One AI call's lifecycle: load on mount, expose a retry, cancel on unmount.
 *
 * The resource page fires two of these (a summary and a next-step plan) and they
 * resolve independently, so each block paints as soon as its own call lands
 * instead of both waiting on the slower one. Keeping the lifecycle here is what
 * makes that independence cheap — the screen holds two `useAiGuidance` calls
 * rather than two near-identical effects.
 *
 * `load` is read through a ref so callers can pass an inline closure; the call
 * re-runs when `resetKey` (the resource id) changes or `retry()` is tapped.
 */
export function useAiGuidance<T>(load: () => Promise<T>, resetKey: string): AiGuidance<T> {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Kept in sync in its own effect (declared first, so it lands before the load
  // effect below re-runs) rather than during render, which React forbids.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    setData(null);
    setFailed(false);
    loadRef
      .current()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        // A real AI proxy can fail — surface a retry instead of skeletons forever.
        // Reported as well as shown: every resource read goes to Sentry, and AI
        // failing silently meant a broken proxy or an exhausted budget looked
        // like nothing at all from the outside.
        reportDataError('AI guidance', error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [resetKey, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, failed, retry };
}
