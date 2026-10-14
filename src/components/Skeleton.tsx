import { useEffect } from 'react';
import { type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, loops, radii } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  /** Offsets the start of the pulse, so a stack of bars ripples instead of
   *  blinking in unison. */
  delay?: number;
  /** Bar fill. The default reads on `background`/`surface`; pass a stronger
   *  value on a tinted surface, where the muted default all but disappears. */
  color?: string;
};

// A pulsing placeholder block for content that is still loading. Compose a few
// of these where the real lines will appear (instead of a centered spinner).
// Purely visual: hidden from screen readers — the surrounding container keeps
// a real accessibility loading label.
export function Skeleton({
  width = '100%',
  height = 14,
  borderRadius = radii.sm,
  delay = 0,
  color = colors.surfaceMuted,
}: SkeletonProps) {
  const opacity = useSharedValue(1);
  const reduced = useReducedMotion();

  useEffect(() => {
    // A loop has no "finished frame" to snap to, so Reduce Motion is the one
    // case the library default cannot handle for us: hold the bar at full
    // strength and never start the pulse.
    if (reduced) {
      cancelAnimation(opacity);
      opacity.set(1);
      return;
    }
    // The delay runs once up front rather than inside the loop, so the bars stay
    // permanently out of phase instead of re-syncing every cycle.
    const start = setTimeout(() => {
      opacity.set(
        withRepeat(
          withSequence(
            withTiming(0.45, { duration: loops.pulseLeg }),
            withTiming(1, { duration: loops.pulseLeg }),
          ),
          -1,
        ),
      );
    }, delay);
    // A loop keeps running on the UI thread unless it is cancelled.
    return () => {
      clearTimeout(start);
      cancelAnimation(opacity);
    };
  }, [opacity, delay, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius, backgroundColor: color }, animatedStyle]}
    />
  );
}
