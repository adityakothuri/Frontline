import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the OS "Reduce Motion" setting is on. One shared source so every
 * animated surface degrades consistently (a crossfade or an instant state),
 * instead of each screen re-implementing the `AccessibilityInfo` check inline.
 * Starts `false` and updates after the first async read and on any change.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
