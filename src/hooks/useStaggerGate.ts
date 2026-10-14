import { useEffect, useRef } from 'react';
import { durations, stagger } from '@/theme';

/**
 * Decides whether a list row is allowed a staggered entrance.
 *
 * A `FlatList` mounts rows as they scroll into view and unmounts them as they
 * leave, so an unguarded `entering` animation has two failure modes: rows far
 * down the list wait out a delay proportional to their index before appearing,
 * and any row scrolled back into view animates again — a fade-in halfway down a
 * moving list, which reads as a glitch rather than as polish.
 *
 * So the stagger is spent only where it is actually seen: the first screenful,
 * on the first paint after the data changed. `resetKey` is whatever identifies
 * the current data (the selected filter, the search results); changing it earns
 * a fresh entrance.
 *
 * This returns a ref rather than state on purpose — flipping it must not
 * re-render the list, and `renderItem` reads it at render time anyway.
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
