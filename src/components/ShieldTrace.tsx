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
 * The Frontline shield, drawn on stroke-first — the app's loading state.
 *
 * The shape of the animation follows the shape of the wait. While the resource
 * is still loading, a **fixed-length arc travels the outline, lap after lap**,
 * breathing a little in length as it goes: that loop carries no information
 * beyond "still working", so it never resolves into anything. It is deliberately
 * never empty and never complete. An earlier version filled the outline in and
 * erased it back off on every cycle, which read as a progress bar that kept
 * failing; a complete outline is the finale's to give, not the wait's.
 * The star is the payoff and is held back entirely — it only draws once the data
 * is actually there (`done`), blooms, throws off a burst of celebration lines,
 * and the whole mark fades downward to hand over to the content.
 *
 * Holding an arc at a constant length takes two degrees of freedom, a head and a
 * tail, where `strokeDashoffset` alone gives one. So `strokeDasharray` animates
 * with it — both are on react-native-svg's animatable native prop list.
 *
 * Geometry is authored here in a 100x100 viewBox rather than traced from
 * `assets/icon.png`, so the mark stays crisp at any size and takes the accent
 * colour.
 *
 * Every value below is driven from the UI thread through `useAnimatedProps`.
 * That matters more here than anywhere else in the app: `strokeDashoffset` is
 * neither a transform nor an opacity, so under RN's `Animated` it could not use
 * the native driver — meaning the mark stuttered precisely when the JS thread
 * was busy parsing the response it was waiting on.
 */
const OUTER = 'M 50 8 L 85 20 L 85 45 C 85 68 70 84 50 92 C 30 84 15 68 15 45 L 15 20 Z';
const INNER = 'M 50 17 L 77 26.5 L 77 46 C 77 63 65 76 50 83 C 35 76 23 63 23 46 L 23 26.5 Z';
const STAR =
  'M 50 29 L 54.47 41.85 L 68.07 42.13 L 57.23 50.35 L 61.17 63.37 ' +
  'L 50 55.6 L 38.83 63.37 L 42.77 50.35 L 31.93 42.13 L 45.53 41.85 Z';

/**
 * The celebration burst: eight short spokes ringing the star, sitting in the gap
 * between its points and the inner rule. They are drawn with the same
 * dash-offset trick as everything else, so they shoot outward rather than just
 * appearing.
 */
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

/**
 * True path lengths, measured by integrating the `d` strings above (straight
 * segments exactly, cubics by 2000-sample arc length) rather than estimated.
 *
 * The precision earns its keep on the two outline paths: their dash pattern is
 * built to sum to exactly one path length, which is what makes the travelling arc
 * wrap invisibly (see the worklets below). An estimate that was off by a unit put
 * a visible stutter at the seam once per lap. The previous `OUTER_LENGTH = 248`
 * was also *under* the real 248.96, so the outline's tail never quite closed.
 */
const OUTER_LENGTH = 248.96;
const INNER_LENGTH = 193.1;
const STAR_LENGTH = 136.04;

/** How much of each outline the travelling arc lights while waiting. */
const OUTER_ARC = 0.38;
const INNER_ARC = 0.3;
/**
 * How far the arc lengthens and shortens over a lap, as a fraction of itself.
 * The trailing edge holds a constant speed and the leading edge does the
 * breathing, so the mark reads as a light sweeping round rather than a bar
 * filling. Kept small — past ~0.2 it starts to look like the fill/empty cycle
 * this replaced.
 */
const ARC_BREATH = 0.12;
/** How far behind the outer arc the inner one runs, as a fraction of a lap. */
const INNER_LAG = 0.06;
/** Neither platform's dash renderer is safe with a literal zero-length gap. */
const MIN_GAP = 0.01;

/** The star's fill at full bloom — a wash, not a solid. */
const STAR_FILL = 0.18;

/**
 * When the star has finished blooming, and so the earliest the mark may leave.
 * The outline's close overlaps the star's draw deliberately — run end-to-end they
 * read as two separate events, overlapped they read as one gesture.
 */
const FINALE_MS = durations.micro + durations.base;

type ShieldTraceProps = {
  size?: number;
  /** Stroke colour. Defaults to the action olive. */
  color?: string;
  /**
   * The thing being waited on is ready. Flips the mark out of its waiting loop
   * and into the finale; `onFinish` follows once the fade completes.
   */
  done?: boolean;
  /**
   * Run the finale but keep the finished mark on screen instead of fading it
   * down. For the one place the shield is the destination rather than a
   * handover — the end of onboarding.
   */
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

  // Held in a ref so a caller passing an inline callback cannot restart the loop
  // on every render. Synced in its own effect — React forbids writing refs during
  // render.
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });
  // Stable identity so the worklet below has something safe to hand back to JS.
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
        // Reduce Motion: hold the completed outline instead of sweeping. A loop
        // has no finished frame for the library to snap to, so this is one of
        // the few places the degrade has to be written out by hand.
        sweep.set(0);
        seal.set(1);
        return;
      }
      sweep.set(0);
      // Lap after lap at a constant speed. `linear` is not a stylistic choice
      // here: any easing puts its slow end at the wrap, which is the one frame
      // the arc has to cross without a hitch.
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

    // The payoff: freeze the arc where the wait ended and grow it shut from
    // there, draw and bloom the star with its burst, then fade the whole mark
    // downward. Freezing first is what stops the outline sliding round while it
    // closes, which read as the mark being yanked.
    cancelAnimation(sweep);
    // `base`, not `fast`: the arc has ~60% of the outline left to cover, and over
    // 180ms that is ~600pt/s — a flash-fill rather than a close. 240ms also keeps
    // `FINALE_MS` exactly as it was, and still lands before the star finishes.
    seal.set(withTiming(1, { duration: durations.base, easing: easings.out }));
    star.set(
      withDelay(durations.micro, withTiming(1, { duration: durations.base, easing: easings.out })),
    );

    if (hold) {
      // Nothing to hand over to — the finished mark is the destination. `exit` is
      // pinned rather than assumed: every other branch states it outright, and a
      // caller that ever flipped `hold` true *after* `done` would otherwise leave
      // the mark stuck part-faded and part-dropped.
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
   * One arc, travelling. `dash` and the gap always sum to exactly one path
   * length, so the dash pattern's period *is* the path: advancing the offset by a
   * whole length lands on a bit-identical pattern, which is what lets `sweep`
   * wrap 1 -> 0 with nothing to see. The breath is period-locked to the lap for
   * the same reason — sin(2*pi*t) is equal at both ends of the cycle, so it
   * cannot introduce a seam the travel doesn't have.
   *
   * `seal` grows the arc to the full length for the finale. At 1 the gap is
   * effectively nil, so the outline reads as closed wherever the sweep froze.
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
  // The inner rule runs the same lap a little behind, so the two strokes read as
  // one gesture with depth rather than two rings moving in lockstep.
  const innerProps = useAnimatedProps(() => {
    const lap = sweep.get() - INNER_LAG;
    const breath = 1 + ARC_BREATH * Math.sin(2 * Math.PI * lap);
    const dash = interpolate(seal.get(), [0, 1], [INNER_LENGTH * INNER_ARC * breath, INNER_LENGTH]);
    return {
      strokeDasharray: [dash, Math.max(INNER_LENGTH - dash, MIN_GAP)],
      strokeDashoffset: -INNER_LENGTH * lap,
    };
  });

  // One value runs the whole finale: the star draws across the first half, then
  // its fill blooms while the burst shoots out.
  const starProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(star.get(), [0, 0.5, 1], [STAR_LENGTH, 0, 0]),
    fillOpacity: interpolate(star.get(), [0, 0.45, 1], [0, 0, STAR_FILL]),
  }));
  // All eight spokes share one offset, so they shoot out together.
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
            // The at-rest arc, so the very first frame is already right — before
            // the worklet has run there is no animated value to read.
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
