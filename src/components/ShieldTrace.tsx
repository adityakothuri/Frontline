import { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, durations, loops, rise } from '@/theme';
import { easings } from '@/theme/motionPresets';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The Frontline shield, drawn stroke-first — the app's loading state.
 *
 * While waiting, a fixed-length arc travels the outline lap after lap; it never
 * completes, because a closed outline is the finale's. When `done`, the arc grows
 * shut, the star draws and bursts, and the mark fades down into the content.
 *
 * A constant-length travelling arc needs both `strokeDasharray` and
 * `strokeDashoffset` animated. Everything runs on the UI thread via
 * `useAnimatedProps`, so the mark keeps moving while JS parses the response.
 */
const OUTER = 'M 50 8 L 85 20 L 85 45 C 85 68 70 84 50 92 C 30 84 15 68 15 45 L 15 20 Z';
const INNER = 'M 50 17 L 77 26.5 L 77 46 C 77 63 65 76 50 83 C 35 76 23 63 23 46 L 23 26.5 Z';
const STAR =
  'M 50 29 L 54.47 41.85 L 68.07 42.13 L 57.23 50.35 L 61.17 63.37 ' +
  'L 50 55.6 L 38.83 63.37 L 42.77 50.35 L 31.93 42.13 L 45.53 41.85 Z';

/** Eight short spokes around the star, drawn by dash offset so they shoot outward. */
const BURST = [
  'M 50 27 L 50 22',
  'M 64.85 33.15 L 68.38 29.62',
  'M 71 48 L 76 48',
  'M 64.85 62.85 L 68.38 66.38',
  'M 50 69 L 50 74',
  'M 35.15 62.85 L 31.62 66.38',
  'M 29 48 L 24 48',
  'M 35.15 33.15 L 31.62 29.62',
];
const BURST_LENGTH = 5;

/** Measured path lengths of the `d` strings above. Must be exact: the outline
 *  dash pattern sums to one path length, and any error shows a seam each lap. */
const OUTER_LENGTH = 248.96;
const INNER_LENGTH = 193.1;
const STAR_LENGTH = 136.04;

/** How much of each outline the travelling arc lights while waiting. */
const OUTER_ARC = 0.38;
const INNER_ARC = 0.3;
/** How much the arc's length breathes over a lap. Past ~0.2 it reads as a
 *  progress bar filling. */
const ARC_BREATH = 0.12;
/** How far behind the outer arc the inner one runs, as a fraction of a lap. */
const INNER_LAG = 0.06;
/** Neither platform's dash renderer is safe with a literal zero-length gap. */
const MIN_GAP = 0.01;

/** The star's fill at full bloom — a wash, not a solid. */
const STAR_FILL = 0.18;

/** When the star has finished blooming: the earliest the mark may leave. The
 *  outline's close overlaps the star's draw so they read as one gesture. */
const FINALE_MS = durations.micro + durations.base;

type ShieldTraceProps = {
  size?: number;
  /** Stroke colour. Defaults to the action olive. */
  color?: string;
  /** The wait is over: play the finale, then call `onFinish`. */
  done?: boolean;
  /** Keep the finished mark on screen instead of fading it (end of onboarding). */
  hold?: boolean;
  onFinish?: () => void;
};

export function ShieldTrace({
  size = 72,
  color = colors.accent,
  done = false,
  hold = false,
  onFinish,
}: ShieldTraceProps) {
  const reduced = useReducedMotion();
  // Where the arc sits on the outline, counted in laps. Wraps 1 -> 0 invisibly.
  const sweep = useSharedValue(0);
  // 0 = the waiting arc, 1 = grown shut into a complete outline.
  const seal = useSharedValue(0);
  const star = useSharedValue(0);
  const exit = useSharedValue(0);

  // A ref, so an inline `onFinish` cannot restart the loop on every render.
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });
  const notify = useCallback(() => finishRef.current?.(), []);

  useEffect(() => {
    if (!done) {
      cancelAnimation(sweep);
      cancelAnimation(seal);
      cancelAnimation(star);
      cancelAnimation(exit);
      seal.set(0);
      star.set(0);
      exit.set(0);
      if (reduced) {
        // Reduce Motion: hold the completed outline. A loop has no end frame for
        // Reanimated to snap to, so this is written out by hand.
        sweep.set(0);
        seal.set(1);
        return;
      }
      sweep.set(0);
      // Must be linear: any easing would put a hitch at the wrap.
      sweep.set(
        withRepeat(withTiming(1, { duration: loops.shieldTrace, easing: easings.linear }), -1),
      );
      return () => cancelAnimation(sweep);
    }

    if (reduced) {
      cancelAnimation(sweep);
      cancelAnimation(seal);
      cancelAnimation(star);
      cancelAnimation(exit);
      sweep.set(0);
      seal.set(1);
      star.set(1);
      exit.set(hold ? 0 : 1);
      const timer = setTimeout(notify, durations.micro);
      return () => clearTimeout(timer);
    }

    // Finale: freeze the arc where it is (so it doesn't slide while closing),
    // grow it shut, bloom the star, then fade the mark down.
    cancelAnimation(sweep);
    seal.set(withTiming(1, { duration: durations.base, easing: easings.out }));
    star.set(
      withDelay(durations.micro, withTiming(1, { duration: durations.base, easing: easings.out })),
    );

    if (hold) {
      // Pin `exit` explicitly in case `hold` flips true after `done`.
      cancelAnimation(exit);
      exit.set(0);
      const timer = setTimeout(notify, FINALE_MS);
      return () => {
        clearTimeout(timer);
        cancelAnimation(seal);
        cancelAnimation(star);
      };
    }

    exit.set(
      withDelay(
        FINALE_MS,
        withTiming(1, { duration: durations.fast, easing: easings.in }, (finished) => {
          'worklet';
          if (finished) runOnJS(notify)();
        }),
      ),
    );
    return () => {
      cancelAnimation(seal);
      cancelAnimation(star);
      cancelAnimation(exit);
    };
  }, [done, hold, exit, notify, reduced, seal, star, sweep]);

  /**
   * Dash + gap sum to one path length, so `sweep` can wrap 1 -> 0 invisibly; the
   * breath is period-locked to the lap for the same reason. `seal` grows the arc
   * to the full length for the finale.
   */
  const outerProps = useAnimatedProps(() => {
    const lap = sweep.get();
    const breath = 1 + ARC_BREATH * Math.sin(2 * Math.PI * lap);
    const dash = interpolate(seal.get(), [0, 1], [OUTER_LENGTH * OUTER_ARC * breath, OUTER_LENGTH]);
    return {
      strokeDasharray: [dash, Math.max(OUTER_LENGTH - dash, MIN_GAP)],
      strokeDashoffset: -OUTER_LENGTH * lap,
    };
  });
  // The inner rule runs slightly behind the outer one.
  const innerProps = useAnimatedProps(() => {
    const lap = sweep.get() - INNER_LAG;
    const breath = 1 + ARC_BREATH * Math.sin(2 * Math.PI * lap);
    const dash = interpolate(seal.get(), [0, 1], [INNER_LENGTH * INNER_ARC * breath, INNER_LENGTH]);
    return {
      strokeDasharray: [dash, Math.max(INNER_LENGTH - dash, MIN_GAP)],
      strokeDashoffset: -INNER_LENGTH * lap,
    };
  });

  // The star draws over the first half, then fills while the burst shoots out.
  const starProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(star.get(), [0, 0.5, 1], [STAR_LENGTH, 0, 0]),
    fillOpacity: interpolate(star.get(), [0, 0.45, 1], [0, 0, STAR_FILL]),
  }));
  const burstProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(star.get(), [0, 0.45, 1], [BURST_LENGTH, BURST_LENGTH, 0]),
  }));

  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: [{ translateY: exit.get() * rise.sm }],
  }));

  return (
    <Animated.View
      style={[styles.root, rootStyle]}
      // Purely decorative: the surrounding loading container owns the label.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <AnimatedPath
            d={OUTER}
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            // Static at-rest arc for the first frame, before the worklet runs.
            strokeDasharray={[OUTER_LENGTH * OUTER_ARC, OUTER_LENGTH * (1 - OUTER_ARC)]}
            animatedProps={outerProps}
          />
          <AnimatedPath
            d={INNER}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[INNER_LENGTH * INNER_ARC, INNER_LENGTH * (1 - INNER_ARC)]}
            animatedProps={innerProps}
          />
          <AnimatedPath
            d={STAR}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={color}
            strokeDasharray={`${STAR_LENGTH} ${STAR_LENGTH}`}
            animatedProps={starProps}
          />
          {BURST.map((d) => (
            <AnimatedPath
              key={d}
              d={d}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${BURST_LENGTH} ${BURST_LENGTH}`}
              animatedProps={burstProps}
            />
          ))}
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
});
