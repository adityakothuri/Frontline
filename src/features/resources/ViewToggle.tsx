import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, radii, spacing, springs } from '@/theme';
import { tapSelection } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type ResultsView = 'list' | 'map';

const OPTIONS: { value: ResultsView; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'list', label: 'List', icon: 'list-outline' },
  { value: 'map', label: 'Map', icon: 'map-outline' },
];

type Frame = { x: number; width: number };

// Segmented control that flips Results between the list and the map. Both views
// render the same result set, so this only swaps presentation.
//
// One olive pill slides between the two segments — the same mechanism as the
// Discover shell row — instead of each segment painting its own background, so
// the switch reads as one thing moving. Each segment is a real 44pt target; it
// used to be ~26pt with no slop, the smallest control in the app.
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
            // "List" / "Map" alone doesn't say what the control does; naming the
            // action makes the segment self-explanatory out of context.
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
            <Ionicons
              name={opt.icon}
              size={16}
              color={selected ? colors.textOnAccent : colors.textSecondary}
            />
            <AppText variant="label" color={selected ? 'textOnAccent' : 'textSecondary'}>
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
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
  },
  // Sits behind the segments, in the same coordinate space their onLayout reports.
  pill: {
    position: 'absolute',
    top: spacing.xs,
    bottom: spacing.xs,
    left: 0,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
  },
});
