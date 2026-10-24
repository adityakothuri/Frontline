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
 * `load` is read through a ref so callers can pass an inline closure; the call
 * re-runs when `resetKey` changes or `retry()` is called.
 */
export function useAiGuidance<T>(load: () => Promise<T>, resetKey: string): AiGuidance<T> {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Synced in an effect declared before the load effect, so it updates first.
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
        // Show a retry, and report so a broken proxy or exhausted budget is visible.
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
