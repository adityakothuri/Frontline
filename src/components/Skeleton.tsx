import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type DimensionValue } from 'react-native';
import { colors, radii } from '@/theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
};

// A pulsing placeholder block for content that is still loading. Compose a few
// of these where the real lines will appear (instead of a centered spinner).
// Purely visual: hidden from screen readers — the surrounding container keeps
// a real accessibility loading label.
export function Skeleton({ width = '100%', height = 14, borderRadius = radii.sm }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    // Native-driver loops keep running on the UI thread unless stopped.
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { width, height, borderRadius, opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceMuted },
});
