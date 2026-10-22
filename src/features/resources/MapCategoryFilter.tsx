import { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, CategoryMedallion, PressableScale } from '@/components';
import { colors, durations, pressScale, radii, rise, spacing, withAlpha } from '@/theme';
import { fadeOut, riseIn } from '@/theme/motionPresets';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { RESOURCE_CATEGORY_META, type ResourceCategory } from '@/types/resource';

/** One category present in the current result set, and how many places it pins. */
export type CategoryCount = { category: ResourceCategory; count: number };

type MapCategoryFilterProps = {
  /** Every category with at least one pinned place, in display order. Counts are
   *  of the *unfiltered* set, so they never move as chips are toggled. */
  counts: CategoryCount[];
  /** Categories currently switched off. Storing what's hidden rather than what's
   *  shown is what makes a category that appears after a ZIP change default to
   *  visible instead of silently missing. */
  hidden: Set<ResourceCategory>;
  onToggle: (category: ResourceCategory) => void;
  onShowAll: () => void;
};

/**
 * The category row in the Map tab's header — a legend you can operate.
 *
 * It reads exactly like the legend it grew out of: a scrolling row of tinted
 * pills, each an icon, a label and a count. The difference is that every pill is
 * a switch, which is how a veteran cuts a few hundred markers down to the two
 * categories they actually came for.
 *
 * *(For one day it was a rail of icon-only circles that grew labels as you
 * narrowed. Compact, and too clever: it read as a row of unexplained buttons on
 * arrival, which is the state a veteran sees first.)*
 *
 * Three rules shape the visual:
 *
 *   - Category hues are an *identity* layer, so they cannot carry the on/off
 *     state on their own, and nothing here may signal meaning by colour alone.
 *     On/off is carried by the **glyph filling in** (the same two-channel idiom
 *     the tab bar uses — see `app/(tabs)/_layout.tsx`) **and** by the count
 *     appearing, on top of the wash. Two non-colour signals.
 *   - The wash is the `0.16` medallion tier, because that is the identity tier.
 *     `0.14` fill with a `0.45` border is deliberately reserved: it is the AI
 *     guidance block's signature, and a filter chip is not AI.
 *   - The `Show all` reset is olive, because clearing a filter is an action, and
 *     olive owns every action in this app.
 */
export function MapCategoryFilter({ counts, hidden, onToggle, onShowAll }: MapCategoryFilterProps) {
  const reduced = useReducedMotion();
  const filtering = hidden.size > 0;
  const edges = useScrollEdges();
  // `layout` only. `LinearTransition` is a *layout* animation: its worklet reads
  // `values.currentOriginX / currentWidth / …`, which the entering path does not
  // supply, so as an `entering` prop it computes its first frame from
  // `undefined`. It type-checks because both extend `BaseAnimationBuilder`, which
  // is exactly why it was easy to get wrong.
  const flow = reduced ? undefined : LinearTransition.duration(durations.base);

  return (
    // Named as a group, or a screen-reader user swipes into eleven unexplained
    // checkboxes with no idea what they belong to.
    <View
      style={styles.root}
      accessibilityRole="toolbar"
      accessibilityLabel="Filter pins by category"
    >
      {/* Outside the ScrollView on purpose. With eleven categories the row runs
          well past a phone's width, so a reset living at scroll offset 0 is
          behind you exactly when you've scrolled out to switch something off. */}
      {filtering ? (
        <Animated.View
          entering={reduced ? undefined : riseIn(0, rise.sm)}
          exiting={reduced ? undefined : fadeOut()}
          layout={flow}
          style={styles.resetSlot}
        >
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Show all categories"
            onPress={onShowAll}
            scaleTo={pressScale.chip}
            style={[styles.chip, styles.showAll]}
          >
            <Ionicons name="checkmark-done-outline" size={15} color={colors.accent} />
            {/* The same words the every-category-off empty state tells the
                veteran to look for. */}
            <AppText variant="label" color="accentPressed">
              Show all
            </AppText>
          </PressableScale>
        </Animated.View>
      ) : null}

      {/* The scroller and the two fades that tell you it is one. With eleven
          categories the row runs a couple of screens wide, and it used to end
          flush against the bezel — which reads as a row that has been cut off
          rather than one that continues. Each fade only appears when there is
          actually something past that edge. */}
      <View style={styles.scrollWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Without this the row stretches to fill its parent and the chips balloon
          // with it — the same trap documented in CategoryShells.
          style={styles.scroll}
          contentContainerStyle={[styles.row, filtering && styles.rowAfterReset]}
          onLayout={edges.onLayout}
          onContentSizeChange={edges.onContentSizeChange}
          onScroll={edges.onScroll}
          scrollEventThrottle={32}
        >
          {counts.map(({ category, count }) => {
            const meta = RESOURCE_CATEGORY_META[category];
            const shown = !hidden.has(category);
            return (
              <Animated.View key={category} layout={flow}>
                <PressableScale
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: shown }}
                  accessibilityLabel={`${meta.label}, ${count} ${count === 1 ? 'place' : 'places'}`}
                  accessibilityHint={shown ? 'Hides these pins' : 'Shows these pins'}
                  onPress={() => onToggle(category)}
                  scaleTo={pressScale.chip}
                  style={[styles.chip, shown ? styles.chipOn : styles.chipOff]}
                >
                  {/* The same medallion the resource cards lead with, at chip
                    scale: the hue lives in a small rounded square rather than
                    flooding the whole pill. Switched off it takes `textMuted` as
                    its hue, so the component greys out whole rather than needing
                    a second styling path. The glyph fills in when on — one of the
                    two non-colour signals. */}
                  <CategoryMedallion
                    icon={shown ? filledIcon(meta.icon) : meta.icon}
                    color={shown ? meta.color : colors.textMuted}
                    size={26}
                  />
                  <AppText variant="label" color={shown ? 'textPrimary' : 'textMuted'}>
                    {meta.label}
                  </AppText>
                  {/* The count is the second non-colour signal, and it only ever
                    describes what is on the map. */}
                  {shown ? (
                    <AppText variant="label" color="textSecondary">
                      {count}
                    </AppText>
                  ) : null}
                </PressableScale>
              </Animated.View>
            );
          })}
        </ScrollView>

        {edges.start ? <EdgeFade side="start" /> : null}
        {edges.end ? <EdgeFade side="end" /> : null}
      </View>
    </View>
  );
}

/** How wide the fade at each end of the chip row is, and how many points of slop
 *  count as "already at the end" — a `ScrollView` routinely reports a fractional
 *  offset at rest, and without the tolerance the fade flickers on and off there. */
const EDGE_FADE = 28;
const EDGE_SLOP = 2;

/**
 * Which ends of the chip row have more row past them.
 *
 * The measurements live in a ref and only the *booleans* live in state, so
 * scrolling the row re-renders it on the two or three frames where a fade
 * actually appears or disappears rather than on every frame of the gesture —
 * the same bail-out `ResourceMap` uses for the pin tier.
 */
function useScrollEdges() {
  const [edges, setEdges] = useState({ start: false, end: false });
  const metrics = useRef({ viewport: 0, content: 0, offset: 0 });

  const measure = useCallback(() => {
    const { viewport, content, offset } = metrics.current;
    const start = offset > EDGE_SLOP;
    const end = content - viewport - offset > EDGE_SLOP;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      metrics.current.viewport = e.nativeEvent.layout.width;
      measure();
    },
    [measure],
  );
  const onContentSizeChange = useCallback(
    (width: number) => {
      metrics.current.content = width;
      measure();
    },
    [measure],
  );
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      metrics.current.offset = e.nativeEvent.contentOffset.x;
      measure();
    },
    [measure],
  );

  return { ...edges, onLayout, onContentSizeChange, onScroll };
}

/**
 * A soft edge on the chip row, drawn as an SVG gradient rather than by adding a
 * gradient dependency — `react-native-svg` is already here for the map pins.
 *
 * It fades to `colors.background` because that is what the header band is made
 * of; a fade to anything else would show as a bar.
 */
function EdgeFade({ side }: { side: 'start' | 'end' }) {
  const id = `chip-fade-${side}`;
  const opaqueFirst = side === 'start';
  return (
    <Svg
      width={EDGE_FADE}
      height="100%"
      pointerEvents="none"
      style={[styles.fade, opaqueFirst ? styles.fadeStart : styles.fadeEnd]}
    >
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.background} stopOpacity={opaqueFirst ? 1 : 0} />
          <Stop offset="1" stopColor={colors.background} stopOpacity={opaqueFirst ? 0 : 1} />
        </SvgGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** `medkit-outline` → `medkit`. The filled twin of a category glyph. */
function filledIcon(outline: keyof typeof Ionicons.glyphMap): keyof typeof Ionicons.glyphMap {
  return outline.replace(/-outline$/, '') as keyof typeof Ionicons.glyphMap;
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center' },
  resetSlot: { paddingLeft: spacing.xl },
  // Holds the scroller and its two fades in the same box. `flexShrink` rather
  // than `flex: 1` so the reset chip beside it keeps its natural width.
  scrollWrap: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  fade: { position: 'absolute', top: 0, bottom: 0 },
  fadeStart: { left: 0 },
  fadeEnd: { right: 0 },
  // The row scrolls edge to edge but starts on the screen's margin, so the chips
  // line up with the location control above them and still run off the side.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  // The reset already provides the leading margin when it is present.
  rowAfterReset: { paddingLeft: spacing.sm },
  // Each chip is a small card, built from the same materials as the resource
  // cards it sits above: paper, a hairline, and one small medallion carrying the
  // hue. `radii.sm`, not `radii.sm` — a fully round pill full of saturated
  // colour is what made this row read as playful; a squarer chip with the colour
  // confined to its medallion reads as part of the same product as the cards.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // A real 44pt target, not a 28pt pill topped up with hitSlop — the minimum
    // every other control in the app meets, and the one thing the original legend
    // could not claim, because the original legend was not tappable.
    minHeight: 44,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  // On is a card that has lifted off the page; off is flush with it. The fill is
  // doing the work a saturated wash used to, at a fraction of the volume.
  chipOn: { backgroundColor: colors.surface },
  chipOff: { backgroundColor: colors.background },
  // Olive, because clearing a filter is an action and olive owns actions — but a
  // transparency of it rather than the solid, or this secondary reset carries a
  // 5:1 border in a row where nothing else exceeds the hairline.
  showAll: {
    backgroundColor: colors.accentSoft,
    borderColor: withAlpha(colors.accent, 0.45),
    paddingLeft: spacing.md,
  },
});
