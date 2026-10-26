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
import { AppText, PressableScale } from '@/components';
import { colors, durations, pressScale, radii, rise, spacing, swatchStyle } from '@/theme';
import { fadeOut, riseIn } from '@/theme/motionPresets';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { RESOURCE_CATEGORY_META, type ResourceCategory } from '@/types/resource';

/** One category present in the current result set, and how many places it pins. */
export type CategoryCount = { category: ResourceCategory; count: number };

type MapCategoryFilterProps = {
  /** Categories with at least one pin, in display order. Counts are of the
   *  unfiltered set, so they do not move as chips toggle. */
  counts: CategoryCount[];
  /** Categories switched off. Stored as hidden (not shown) so a category that
   *  appears after a ZIP change defaults to visible. */
  hidden: Set<ResourceCategory>;
  onToggle: (category: ResourceCategory) => void;
  onShowAll: () => void;
};

/**
 * The Map tab's category row: a legend where every chip toggles its pins.
 * On/off never relies on colour alone — frame weight, swatch fill and count all
 * change. `Show all` is olive because it is an action.
 */
export function MapCategoryFilter({ counts, hidden, onToggle, onShowAll }: MapCategoryFilterProps) {
  const reduced = useReducedMotion();
  const filtering = hidden.size > 0;
  const edges = useScrollEdges();
  // `layout` only: `LinearTransition` as an `entering` prop type-checks but
  // computes its first frame from undefined layout values.
  const flow = reduced ? undefined : LinearTransition.duration(durations.base);

  return (
    // Named as a group so screen readers know what the checkboxes belong to.
    <View
      style={styles.root}
      accessibilityRole="toolbar"
      accessibilityLabel="Filter pins by category"
    >
      {/* Outside the ScrollView so the reset stays reachable after scrolling. */}
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
            {/* Matches the wording of the all-categories-off empty state. */}
            <AppText variant="data" color="accent">
              Show all
            </AppText>
          </PressableScale>
        </Animated.View>
      ) : null}

      {/* Edge fades show only when there is more row past that edge. Shares the
          chips' `flow` so it glides with them when "Show all" comes and goes. */}
      <Animated.View layout={flow} style={styles.scrollWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Without this the row stretches and the chips balloon (see CategoryShells).
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
                  {/* Off, the swatch goes hollow: shape, not just colour, says it is hidden. */}
                  <View
                    style={[
                      swatchStyle(shown ? meta.color : colors.transparent, 10),
                      !shown && styles.swatchOff,
                    ]}
                  />
                  <AppText variant="data" color={shown ? 'textPrimary' : 'textSecondary'}>
                    {meta.label}
                  </AppText>
                  {/* Second non-colour signal; only shown for categories on the map. */}
                  {shown ? (
                    <AppText variant="data" color="textSecondary">
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
      </Animated.View>
    </View>
  );
}

/** Fade width, and the slop that counts as "at the end" (ScrollView reports
 *  fractional offsets at rest, which would flicker the fade). */
const EDGE_FADE = 28;
const EDGE_SLOP = 2;

/** Which ends of the chip row have more past them. Measurements live in a ref
 *  and only the booleans in state, so scrolling rarely re-renders. */
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

/** A soft edge on the chip row, as an SVG gradient to the header's background. */
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

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center' },
  resetSlot: { paddingLeft: spacing.xl },
  // `flexShrink`, not `flex: 1`, so the reset chip keeps its natural width.
  scrollWrap: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  fade: { position: 'absolute', top: 0, bottom: 0 },
  fadeStart: { left: 0 },
  fadeEnd: { right: 0 },
  // Scrolls edge to edge but starts on the screen margin.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  // The reset already provides the leading margin when it is present.
  rowAfterReset: { paddingLeft: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  chipOn: { borderWidth: 1.5, borderColor: colors.textPrimary },
  chipOff: { borderWidth: 1.5, borderColor: colors.border },
  swatchOff: { borderWidth: 1.5, borderColor: colors.textSecondary },
  showAll: { borderWidth: 1.5, borderColor: colors.accent },
});
