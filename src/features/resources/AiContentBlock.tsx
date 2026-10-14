import { useEffect, useState, type ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Skeleton } from '@/components';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, loops, radii, shadows, spacing, stagger, surfaceTint, withAlpha } from '@/theme';
import { easings, riseIn } from '@/theme/motionPresets';

type AiContentBlockProps = {
  /** Optional heading; omit when a surrounding section already titles the block. */
  title?: string;
  /** The hue of the category this guidance is about (from `*_CATEGORY_META`), so
   *  the block belongs to the resource it sits under. Falls back to the olive
   *  accent where there's no category context. */
  color?: string;
  loading?: boolean;
  /** What the model is doing, in plain words — shown while loading and read out
   *  by screen readers in place of a generic "Generating…". */
  loadingLabel?: string;
  /** The call behind this block failed; renders the retry state in place. */
  failed?: boolean;
  onRetry?: () => void;
  children?: ReactNode;
};

// Presentational chrome that sets AI output visibly apart from official/source
// text, so guidance is never mistaken for the source. It owns no data — the
// caller loads content and passes it (or `loading`/`failed`) in. The
// "AI-generated" tag is the block's one label; the longer not-advice disclaimer
// is deliberately not repeated per block.
//
// The surface is washed with the category hue so the guidance belongs to the
// resource it sits under — but deliberately at HALF the detail hero's strength
// (0.07 vs 0.14), because at equal strength the block became indistinguishable
// from the hero and "is this the source or the model?" stopped being visible.
// The sparkles glyph and the shadow stay constant across categories: they, not
// the hue, are what says "this is AI".
//
// Two AI blocks sit on a resource page and resolve on their own schedules, so
// the block owns the whole wait: the sparkle breathes while the model works,
// the skeleton bars ripple instead of blinking in unison, and content fades and
// rises in on arrival — which is what stops one block filling in beside a still-
// empty neighbour from reading as a layout glitch. All of it degrades to a
// static state under reduce-motion.
export function AiContentBlock({
  title,
  color = colors.accent,
  loading = false,
  loadingLabel = 'Generating…',
  failed = false,
  onRetry,
  children,
}: AiContentBlockProps) {
  const reduced = useReducedMotion();
  // Callers derive `loading` from "no data yet", which stays true after a
  // failure — so the retry state, not the skeletons, decides when we're waiting.
  const busy = loading && !failed;

  // The sparkle is already the block's "this is AI" mark — breathing that glyph
  // says the model is working without adding new furniture to the card.
  const breath = useSharedValue(0);
  useEffect(() => {
    // A loop has no finished frame to snap to, so Reduce Motion is handled here
    // by hand rather than by the library default.
    if (!busy || reduced) {
      cancelAnimation(breath);
      breath.set(0);
      return;
    }
    breath.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: loops.breathLeg }),
          withTiming(0, { duration: loops.breathLeg }),
        ),
        -1,
      ),
    );
    // A loop keeps running on the UI thread unless it is cancelled.
    return () => cancelAnimation(breath);
  }, [breath, busy, reduced]);

  // 0.34, not the 0.28 this started at: the bars pulse down to 45% opacity, and
  // at the old strength the trough was faint enough on the tinted surface that
  // the block read as empty rather than working.
  const barColor = withAlpha(color, 0.34);
  const breathStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.get(), [0, 1], [1, 0.5]),
    transform: [{ scale: interpolate(breath.get(), [0, 1], [1, 1.12]) }],
  }));

  return (
    <View
      style={[
        styles.block,
        {
          backgroundColor: surfaceTint(color, 0.07, colors.background),
          borderColor: withAlpha(color, 0.45),
        },
      ]}
    >
      {title ? (
        <View style={styles.header}>
          <Animated.View style={breathStyle}>
            <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
          </Animated.View>
          <AppText variant="heading" style={styles.title}>
            {title}
          </AppText>
        </View>
      ) : null}
      {/* No generated text to disclaim when the call failed. */}
      {failed ? null : (
        <AppText variant="caption" color="textSecondary" style={styles.tag}>
          AI-generated — verify with the source
        </AppText>
      )}

      {failed ? (
        <RetryState title={title} onRetry={onRetry} />
      ) : busy ? (
        <View
          style={styles.loading}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={loadingLabel}
        >
          <AppText variant="caption" color="textMuted">
            {loadingLabel}
          </AppText>
          <SweepLine color={color} />
          {/* Bars in the category hue: the muted default is near-invisible on
              this tinted surface, and the tint makes the wait feel part of the
              block rather than generic grey furniture. */}
          <Skeleton width="45%" color={barColor} />
          <Skeleton delay={stagger.pulse} color={barColor} />
          <Skeleton width="80%" delay={stagger.pulse * 2} color={barColor} />
        </View>
      ) : (
        // The arrival reveal is what keeps one block filling in beside a still-
        // empty neighbour from reading as a layout glitch.
        <Animated.View entering={riseIn()} style={styles.body}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

/** How much of the track the sweep covers at any moment. */
const SWEEP_ARC = 0.34;

/**
 * A hairline that sweeps across the block, on a loop, while the model works.
 *
 * The skeleton bars below it say "text is going to appear here", but they pulse —
 * and a pulse reads as decoration once you have looked at it twice. An AI call is
 * the longest wait in the app, seconds rather than the ~0.6s a query takes, and
 * over that long something has to actually *travel* for the block to look like
 * work in progress rather than a card that failed to fill in.
 *
 * It is the shield's travelling arc flattened to a line, and it holds its ink
 * constant by the same reasoning. **Two** thumbs run a full track apart: whatever
 * the leading one loses off the right edge, the trailing one gains at the left, so
 * the ink on screen is permanently `thumbWidth`, and at the end of a lap the
 * trailing thumb sits exactly where the leading one started — a bit-identical
 * wrap, the line's version of the shield's dash pattern summing to one path
 * length.
 *
 * A single thumb travelling `width + thumbWidth` was the first cut and was wrong
 * in the same way the old shield was: it ramps in pinned to the left edge, which is
 * the literal grammar of a determinate bar filling, and its ink hits zero once per
 * lap. This block cannot imply a known amount of work remaining, because there
 * isn't one — the model takes as long as it takes.
 */
function SweepLine({ color }: { color: string }) {
  const reduced = useReducedMotion();
  // The travel distance is the track's own width, which only layout knows.
  const [width, setWidth] = useState(0);
  const lap = useSharedValue(0);

  useEffect(() => {
    // Nothing to cross yet, and nothing ever will under Reduce Motion.
    if (width === 0 || reduced) {
      cancelAnimation(lap);
      lap.set(0);
      return;
    }
    lap.set(0);
    lap.set(withRepeat(withTiming(1, { duration: loops.aiSweep, easing: easings.linear }), -1));
    // A loop keeps running on the UI thread unless it is cancelled.
    return () => cancelAnimation(lap);
  }, [lap, reduced, width]);

  // One lap is exactly one track width, which is what lets the pair tile it.
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lap.get() * width }],
  }));

  // An empty tinted track with nothing moving in it is the universal signal for
  // "0% / stalled", which is a worse thing to say than nothing at all. The label
  // and the bars already carry the wait, and `Skeleton` holds those at full
  // strength when Reduce Motion is on.
  if (reduced) return null;

  const thumb = {
    width: width * SWEEP_ARC,
    // Not full saturation: the moving element must not outrank the block's own
    // title or its "verify with the source" tag.
    backgroundColor: withAlpha(color, 0.6),
  };

  return (
    <View
      // Rounded: a sub-pixel width change across layout passes (Android float
      // rounding, rotation, a font-scale change) would otherwise restart the loop
      // and snap the thumbs back to the left edge mid-sweep.
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      // Decorative: the loading container above owns the progressbar label.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.sweepTrack, { backgroundColor: withAlpha(color, 0.18) }]}
    >
      <Animated.View style={[styles.sweepThumb, thumb, styles.sweepLead, thumbStyle]} />
      <Animated.View style={[styles.sweepThumb, thumb, { left: -width }, thumbStyle]} />
    </View>
  );
}

function RetryState({ title, onRetry }: { title?: string; onRetry?: () => void }) {
  const message = (
    <>
      <AppText variant="body" color="danger">
        Couldn’t load this.
      </AppText>
      {onRetry ? (
        <AppText variant="label" color="accentPressed">
          Tap to try again
        </AppText>
      ) : null}
    </>
  );

  if (!onRetry) {
    return (
      <Animated.View entering={riseIn()} style={styles.retry}>
        {message}
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={riseIn()}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title ? `Try loading ${title} again` : 'Try loading this again'}
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
      >
        {message}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radii.lg,
    // A category-tinted fill + border set AI guidance apart as a distinct,
    // "intelligent" surface — not just another neutral card — and tie it to the
    // resource above it. Both colors are applied inline from the `color` prop.
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { flexShrink: 1 },
  tag: { marginBottom: spacing.xs },
  loading: { minHeight: 72, justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
  // 2pt: a rule, not a progress bar. Pulled tight to the label it qualifies and
  // given room above the bar stack, or it reads as a fourth, oddly thin bar.
  sweepTrack: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  sweepThumb: { position: 'absolute', top: 0, height: 2, borderRadius: 1 },
  sweepLead: { left: 0 },
  body: { gap: spacing.sm, marginTop: spacing.xs },
  // Sits inside the block, so a failed call keeps its title and AI surface
  // rather than collapsing the card to a bare error row.
  retry: { gap: spacing.xxs, paddingVertical: spacing.sm, marginTop: spacing.xs },
  pressed: { opacity: 0.6 },
});
