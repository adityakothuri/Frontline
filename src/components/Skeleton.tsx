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
  /** Offsets the pulse start so stacked bars ripple instead of blinking together. */
  delay?: number;
  /** Bar fill; pass a stronger value on tinted surfaces. */
  color?: string;
};

// A pulsing placeholder bar. Hidden from screen readers; the surrounding
// container carries the loading label.
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
    // A loop has no end frame for Reduce Motion to snap to, so hold it static.
    if (reduced) {
      cancelAnimation(opacity);
      opacity.set(1);
      return;
    }
    // Delay once, outside the loop, so bars stay out of phase.
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
