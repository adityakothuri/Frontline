import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, radii, spacing, springs } from '@/theme';
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

type IconName = keyof typeof Ionicons.glyphMap;
/** A shell either filters to a category — taking its label, icon and hue from
 *  the category metadata — or is a sentinel that carries its own. */
type Shell =
  | { id: TopNeedCategory; category: TopNeedCategory }
  | { id: 'all' | 'other'; label: string; icon: IconName };
type Frame = { x: number; width: number };

// The four curated categories are `TOP_NEED_CATEGORIES` — the same shortlist the
// Home quick-start grid uses, so the two surfaces can't disagree about which
// needs are the common ones. Housing sits beside Essentials rather than inside
// it: food and clothing are things a veteran picks up, housing is a program they
// enter, and it is the higher-stakes need of the three. Burying it under "Other"
// cost three taps.
const SHELLS: Shell[] = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  ...TOP_NEED_CATEGORIES.map((category) => ({ id: category, category })),
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

/** What a chip shows: the category's short label and icon, or the sentinel's own. */
function shellDisplay(shell: Shell): { label: string; icon: IconName; color: string } {
  if ('category' in shell) {
    const meta = NEED_CATEGORY_META[shell.category];
    return { label: meta.shortLabel ?? meta.label, icon: meta.icon, color: meta.color };
  }
  return { label: shell.label, icon: shell.icon, color: colors.textSecondary };
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

// A shell chip keeps its category icon even when selected (so the row stays
// recognizable and each category shows its own hue on the icon). Selection is
// carried by the sliding olive pill behind the row plus the checkmark — never
// color alone — so the category hue stays pure identity and olive stays the one
// action/selection color.
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
  const { label, icon, color } = shellDisplay(shell);

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
      <View style={[styles.chip, selected ? styles.chipSelectedText : styles.chipRest]}>
        <Ionicons name={icon} size={16} color={color} />
        <AppText variant="label" color={selected ? 'textPrimary' : 'textSecondary'}>
          {label}
        </AppText>
        {selected ? <Ionicons name="checkmark" size={16} color={colors.accent} /> : null}
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

  // One pill slides between chips instead of each chip painting its own
  // background, so selection reads as a single thing moving rather than one box
  // blinking off and another on.
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  // The pill must appear *at* the selected chip on first layout, not fly in from
  // the left edge.
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
    // Keep the selected chip in view when the row is wider than the screen.
    scrollRef.current?.scrollTo({ x: Math.max(0, frame.x - spacing.xl), animated: !reduced });
  }, [selected, frames, reduced, x, width]);

  const pillStyle = useAnimatedStyle(() => ({
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
      {/* Sits behind the chips, in the same coordinate space their onLayout reports. */}
      <Animated.View style={[styles.pill, pillStyle]} pointerEvents="none" />
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
  // flexGrow:0 keeps the row its natural height — without it the horizontal
  // ScrollView stretches vertically and the chips balloon on re-render.
  scroll: { flexGrow: 0 },
  row: {
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipRest: { backgroundColor: colors.surface, borderColor: colors.border },
  // The selected chip goes transparent: the pill behind it supplies the fill and
  // the border, so only one of them is ever drawing the selection.
  chipSelectedText: { backgroundColor: colors.transparent, borderColor: colors.transparent },
  pill: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    bottom: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
  },
});
