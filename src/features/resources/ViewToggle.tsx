import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, radii, spacing, springs } from '@/theme';
import { tapSelection } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type ResultsView = 'list' | 'map';

const OPTIONS: { value: ResultsView; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'map', label: 'Map' },
];

type Frame = { x: number; width: number };

// Segmented control that flips Results between list and map (same result set).
// One ink block slides between the two 44pt segments.
export function ViewToggle({
  value,
  onChange,
}: {
  value: ResultsView;
  onChange: (next: ResultsView) => void;
}) {
  const reduced = useReducedMotion();
  const [frames, setFrames] = useState<Partial<Record<ResultsView, Frame>>>({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  // The pill must appear *at* the selected segment on first layout, not slide
  // in from the left edge.
  const positioned = useRef(false);

  const onFrame = useCallback((view: ResultsView, e: LayoutChangeEvent) => {
    const { x: fx, width: fw } = e.nativeEvent.layout;
    setFrames((prev) => {
      const existing = prev[view];
      if (existing && existing.x === fx && existing.width === fw) return prev;
      return { ...prev, [view]: { x: fx, width: fw } };
    });
  }, []);

  useEffect(() => {
    const frame = frames[value];
    if (!frame) return;
    if (!positioned.current || reduced) {
      positioned.current = true;
      x.set(frame.x);
      width.set(frame.width);
    } else {
      x.set(withSpring(frame.x, springs.settle));
      width.set(withSpring(frame.width, springs.settle));
    }
  }, [value, frames, reduced, x, width]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    width: width.get(),
  }));

  return (
    <View style={styles.track} accessibilityRole="tablist">
      <Animated.View style={[styles.pill, pillStyle]} pointerEvents="none" />
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <PressableScale
            key={opt.value}
            accessibilityRole="tab"
            // Names the action, since "List" / "Map" alone is unclear out of context.
            accessibilityLabel={`Show results as ${opt.label.toLowerCase()}`}
            accessibilityState={{ selected }}
            onLayout={(e) => onFrame(opt.value, e)}
            onPress={() => {
              if (selected) return;
              tapSelection();
              onChange(opt.value);
            }}
            scaleTo={pressScale.chip}
            style={styles.segment}
          >
            <AppText variant="data" color={selected ? 'surface' : 'textPrimary'}>
              {opt.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  // Sits behind the segments, in the same coordinate space their onLayout reports.
  pill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.textPrimary },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
});
