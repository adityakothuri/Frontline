import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { durations, spacing, timings } from '@/theme';
import { easings } from '@/theme/motionPresets';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AppText } from './AppText';
import { ShieldTrace } from './ShieldTrace';

type LoadingProps = {
  label?: string;
  /** The data has arrived — play the finale. Wire this from `useLoadingGate`. */
  done?: boolean;
  /** Called when the finale has finished and the content may take over. */
  onFinish?: () => void;
};

// The loading state every data-backed screen shows before content arrives. The
// shield draws itself instead of a stock spinner, so a wait still looks like
// Frontline. Screens pass their own label; the container carries it for
// assistive tech (the mark itself is decorative).
//
// This component is deliberately dumb — `useLoadingGate` below owns *when* it is
// on screen, because that decision has to outlive the component itself.
export function Loading({ label, done = false, onFinish }: LoadingProps) {
  const reduced = useReducedMotion();
  const labelFade = useSharedValue(1);

  // The label drops as soon as the data lands, ahead of the shield's finale.
  // Two reasons: "Loading the map…" stops being true the moment it isn't, and
  // leaving it up meant a beat where the text sat there alone after the shield
  // had already faded out.
  useEffect(() => {
    cancelAnimation(labelFade);
    if (!done) {
      labelFade.set(1);
      return;
    }
    if (reduced) {
      labelFade.set(0);
      return;
    }
    labelFade.set(withTiming(0, { duration: durations.fast, easing: easings.in }));
    return () => cancelAnimation(labelFade);
  }, [done, labelFade, reduced]);

  const labelStyle = useAnimatedStyle(() => ({ opacity: labelFade.get() }));

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <ShieldTrace done={done} onFinish={onFinish} />
      {label ? (
        <Animated.View style={labelStyle}>
          <AppText variant="body" color="textSecondary" style={styles.label}>
            {label}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

type LoadingGate = {
  /** Content must not render yet — either still loading, or the finale is playing. */
  holding: boolean;
  /** Render `<Loading>`. False during the initial quiet window. */
  showShield: boolean;
  /** Pass to `<Loading done={…}>`. */
  done: boolean;
  /** Pass to `<Loading onFinish={…}>`. */
  finish: () => void;
};

/**
 * Decides when the shield is on screen, which is a question neither the screen
 * nor `Loading` can answer alone.
 *
 * Two rules, both learned from watching it:
 *
 * 1. **Quiet for the first 500ms.** Since the query work most reads settle in
 *    ~0.6s, and a mark that appeared and was torn away a few frames later read as
 *    choppiness. A load that resolves inside the window shows nothing at all.
 * 2. **If it did appear, it gets to finish.** The star, bloom and burst are the
 *    payoff for an actual wait, so once the shield is up the screen holds content
 *    back for the ~500ms finale rather than cutting it off mid-celebration.
 *
 * A failed load skips the finale entirely — there is nothing to celebrate, and
 * the error state should not be delayed behind a flourish.
 */
export function useLoadingGate(loading: boolean, failed = false): LoadingGate {
  const [showShield, setShowShield] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // Whether the shield actually made it on screen this cycle — the finale is
  // owed only if it did.
  const shown = useRef(false);

  useEffect(() => {
    if (loading) {
      setFinishing(false);
      const timer = setTimeout(() => {
        shown.current = true;
        setShowShield(true);
      }, timings.loadingQuiet);
      return () => clearTimeout(timer);
    }

    // Loading ended. Celebrate only if the veteran actually watched a wait.
    if (shown.current && !failed) {
      setFinishing(true);
    } else {
      setShowShield(false);
      shown.current = false;
    }
  }, [failed, loading]);

  const finish = useCallback(() => {
    setShowShield(false);
    setFinishing(false);
    shown.current = false;
  }, []);

  // The backstop. Normally the screen comes back through `ShieldTrace`'s completion
  // callback, which means a screen rendering nothing at all is waiting on one
  // animation callback with no other way out. Cheap insurance: release the content
  // on `finaleBudget` regardless. If the callback does arrive first, `finishing`
  // goes false and this cleanup cancels the timer, so the two never race.
  useEffect(() => {
    if (!finishing) return;
    const timer = setTimeout(finish, timings.finaleBudget);
    return () => clearTimeout(timer);
  }, [finish, finishing]);

  return {
    holding: loading || showShield,
    showShield,
    done: finishing,
    finish,
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  label: { textAlign: 'center' },
});
