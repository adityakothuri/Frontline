import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, spacing, springs, swatchStyle } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { tapSelection } from '@/lib/haptics';
import {
  NEED_CATEGORY_META,
  TOP_NEED_CATEGORIES,
  type NeedCategory,
  type TopNeedCategory,
} from '@/types/need';

// The Discover shell row. A curated handful of the most-common needs, plus two
// sentinels: `all` (browse everything) and `other` (open the full category list).
export type ShellId = 'all' | 'other' | TopNeedCategory;

/** A shell filters to a category (label and hue from its metadata) or is a sentinel. */
type Shell =
  { id: TopNeedCategory; category: TopNeedCategory } | { id: 'all' | 'other'; label: string };
type Frame = { x: number; width: number };

// The curated categories are the shared `TOP_NEED_CATEGORIES` shortlist.
const SHELLS: Shell[] = [
  { id: 'all', label: 'All' },
  ...TOP_NEED_CATEGORIES.map((category) => ({ id: category, category })),
  { id: 'other', label: 'Other' },
];

/** What a tab shows: the category's short label and hue, or the sentinel's label. */
function shellDisplay(shell: Shell): { label: string; color?: string } {
  if ('category' in shell) {
    const meta = NEED_CATEGORY_META[shell.category];
    return { label: meta.shortLabel ?? meta.label, color: meta.color };
  }
  return { label: shell.label };
}

/** Whether a route param names a real shell. Anything else is ignored. */
export function isShellId(value: unknown): value is ShellId {
  return SHELLS.some((shell) => shell.id === value);
}

/** The need category a shell filters to, or undefined for `all`/`other`. */
export function shellCategory(id: ShellId): NeedCategory | undefined {
  const shell = SHELLS.find((s) => s.id === id);
  return shell && 'category' in shell ? shell.category : undefined;
}

// One tab: swatch and label. Selection is the olive bar plus full-strength ink,
// never colour alone.
function ShellChip({
  shell,
  selected,
  onPress,
  onFrame,
}: {
  shell: Shell;
  selected: boolean;
  onPress: () => void;
  onFrame: (frame: Frame) => void;
}) {
  const { label, color } = shellDisplay(shell);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      onFrame({ x, width });
    },
    [onFrame],
  );

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={pressScale.chip}
      onLayout={handleLayout}
    >
      <View style={styles.tab}>
        {color ? <View style={swatchStyle(color)} /> : null}
        <AppText variant="data" color={selected ? 'textPrimary' : 'textSecondary'}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

export function CategoryShells({
  selected,
  onSelect,
}: {
  selected: ShellId;
  onSelect: (id: ShellId) => void;
}) {
  const reduced = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const [frames, setFrames] = useState<Partial<Record<ShellId, Frame>>>({});

  // One bar slides between tabs rather than each tab drawing its own.
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  // The bar must appear *under* the selected tab on first layout, not fly in
  // from the left edge.
  const positioned = useRef(false);

  const onFrame = useCallback((id: ShellId, frame: Frame) => {
    setFrames((prev) => {
      const existing = prev[id];
      if (existing && existing.x === frame.x && existing.width === frame.width) return prev;
      return { ...prev, [id]: frame };
    });
  }, []);

  useEffect(() => {
    const frame = frames[selected];
    if (!frame) return;
    if (!positioned.current || reduced) {
      positioned.current = true;
      x.set(frame.x);
      width.set(frame.width);
    } else {
      x.set(withSpring(frame.x, springs.settle));
      width.set(withSpring(frame.width, springs.settle));
    }
    // Keep the selected tab in view when the row is wider than the screen.
    scrollRef.current?.scrollTo({ x: Math.max(0, frame.x - spacing.xl), animated: !reduced });
  }, [selected, frames, reduced, x, width]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    width: width.get(),
  }));

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {/* In the same coordinate space the tabs' onLayout reports. */}
      <Animated.View style={[styles.bar, barStyle]} pointerEvents="none" />
      {SHELLS.map((shell) => (
        <ShellChip
          key={shell.id}
          shell={shell}
          selected={shell.id === selected}
          onPress={() => {
            if (shell.id !== selected) tapSelection();
            onSelect(shell.id);
          }}
          onFrame={(frame) => onFrame(shell.id, frame)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexGrow: 0, or the horizontal ScrollView stretches vertically on re-render.
  scroll: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: { gap: spacing.xl, alignItems: 'center', paddingHorizontal: spacing.xl },
  tab: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  bar: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: colors.accent },
});
