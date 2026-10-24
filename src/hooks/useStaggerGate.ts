import { useEffect, useRef } from 'react';
import { durations, stagger } from '@/theme';

/**
 * Whether a list row gets a staggered entrance: only the first screenful, on the
 * first paint after `resetKey` (the current data) changes. Otherwise recycled
 * `FlatList` rows would re-animate mid-scroll. A ref, not state, so closing the
 * window doesn't re-render the list.
 */
export function useStaggerGate(resetKey: unknown) {
  const firstPaint = useRef(true);

  useEffect(() => {
    firstPaint.current = true;
    // Long enough for the last staggered row to finish, then the window closes.
    const timer = setTimeout(
      () => {
        firstPaint.current = false;
      },
      stagger.listCount * stagger.step + durations.base,
    );
    return () => clearTimeout(timer);
  }, [resetKey]);

  return (index: number) => firstPaint.current && index < stagger.listCount;
}
