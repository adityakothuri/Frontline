import { useEffect, useId } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { aiWash, loops } from '@/theme';
import { easings } from '@/theme/motionPresets';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type AiWashProps = {
  /** `deep` lies over the olive card and carries paper text; `paper` lies over a
   *  card surface and carries ink. The geometry is the same — only the strength
   *  changes, so the two read as one material at two exposures. */
  tone: 'deep' | 'paper';
  /** A model is working right now. The blooms drift very slowly; static otherwise
   *  and under Reduce Motion. */
  live?: boolean;
  /** The parent's corner radii, so the wash clips to the same shape. */
  style?: StyleProp<ViewStyle>;
};

/**
 * The watercolor behind everything AI says.
 *
 * Four soft blooms — emerald, sage, ochre and a second emerald — laid on the
 * surface in the hues of `aiWash`, each a radial gradient that fades to nothing
 * well before its edge, so they bleed into each other and into the paper the way
 * a wet wash does rather than sitting on it as discs. The box is 100×100 and
 * stretches to the surface (`preserveAspectRatio="none"`), which is what gives a
 * wide card wide blooms and a tall bubble tall ones from one set of numbers.
 *
 * Drawn with `react-native-svg`, which is already here for the pins and the chip
 * fades — not a gradient dependency (Decision Log, 2026-07-25 and 2026-10-13).
 *
 * The wash clips itself, so a parent that casts a shadow never has to set
 * `overflow: 'hidden'` — on iOS that clips the shadow with it. Callers pass their
 * corner radii through `style`.
 *
 * The drift, when `live`, is two layers moving against each other by a few
 * points: the back layer carries the two large blooms, the front the two small,
 * so the colour relationships shift rather than the whole picture sliding.
 * Each layer is inset past the drift distance, so no edge is ever exposed. A
 * loop has no finished frame, so Reduce Motion is handled here by hand.
 */
export function AiWash({ tone, live = false, style }: AiWashProps) {
  const reduced = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!live || reduced) {
      cancelAnimation(drift);
      drift.set(0);
      return;
    }
    drift.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: loops.aiDrift, easing: easings.inOut }),
          withTiming(0, { duration: loops.aiDrift, easing: easings.inOut }),
        ),
        -1,
      ),
    );
    // A loop keeps running on the UI thread unless it is cancelled.
    return () => cancelAnimation(drift);
  }, [drift, live, reduced]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.get(), [0, 1], [-DRIFT, DRIFT]) },
      { translateY: interpolate(drift.get(), [0, 1], [DRIFT * 0.5, -DRIFT * 0.5]) },
      { scale: interpolate(drift.get(), [0, 1], [1, 1.04]) },
    ],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.get(), [0, 1], [DRIFT, -DRIFT]) },
      { translateY: interpolate(drift.get(), [0, 1], [-DRIFT * 0.5, DRIFT * 0.5]) },
      { scale: interpolate(drift.get(), [0, 1], [1.04, 1]) },
    ],
  }));

  const peak = PEAK[tone];
  return (
    <View
      // Decorative: the surface it sits in carries the "AI-generated" label.
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.root, style]}
    >
      <Animated.View style={[styles.layer, backStyle]}>
        <BloomLayer blooms={BACK} peak={peak} />
      </Animated.View>
      <Animated.View style={[styles.layer, frontStyle]}>
        <BloomLayer blooms={FRONT} peak={peak} />
      </Animated.View>
    </View>
  );
}

/** How far a layer travels from rest while live, in points. */
const DRIFT = 6;

/**
 * Peak alpha at a bloom's centre, per tone. Both are contrast-measured against
 * the text that sits on them — see `aiWash` in `theme/colors.ts`.
 */
const PEAK = { deep: 0.55, paper: 0.14 } as const;

/** One bloom: where it sits in the 100×100 box, how far it reaches, and its
 *  strength relative to the tone's peak. */
type Bloom = { color: string; cx: number; cy: number; r: number; weight: number };

// The two big blooms sit in opposite corners so the surface reads as lit from
// one side and cool on the other; the ochre glow warms the bottom-left, where
// Home's card puts its paper pill, and the small emerald closes the loop. Ochre
// is held to 0.75 of peak: it is the lightest hue, and the one closest to the
// contrast floor over olive.
const BACK: Bloom[] = [
  { color: aiWash.emerald, cx: 14, cy: 8, r: 72, weight: 1 },
  { color: aiWash.sage, cx: 92, cy: 42, r: 64, weight: 0.9 },
];
const FRONT: Bloom[] = [
  { color: aiWash.ochre, cx: 22, cy: 102, r: 52, weight: 0.75 },
  { color: aiWash.emerald, cx: 84, cy: 98, r: 40, weight: 0.6 },
];

function BloomLayer({ blooms, peak }: { blooms: Bloom[]; peak: number }) {
  // SVG ids are global to the screen; several washes render at once in a thread.
  const id = useId().replace(/\W/g, '');
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        {blooms.map((bloom, i) => {
          const alpha = peak * bloom.weight;
          return (
            // Default units: the gradient is centred on, and reaches the edge of,
            // the circle it fills. The middle stop is what makes it a wash — a
            // two-stop fade reads as a spotlight.
            <RadialGradient key={i} id={`${id}-${i}`}>
              <Stop offset="0" stopColor={bloom.color} stopOpacity={alpha} />
              <Stop offset="0.55" stopColor={bloom.color} stopOpacity={alpha * 0.45} />
              <Stop offset="1" stopColor={bloom.color} stopOpacity={0} />
            </RadialGradient>
          );
        })}
      </Defs>
      {blooms.map((bloom, i) => (
        <Circle key={i} cx={bloom.cx} cy={bloom.cy} r={bloom.r} fill={`url(#${id}-${i})`} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  // Oversized by more than the drift, so a layer at full travel still covers.
  layer: { position: 'absolute', top: -DRIFT * 2, left: -DRIFT * 2, right: -DRIFT * 2, bottom: -DRIFT * 2 },
});
