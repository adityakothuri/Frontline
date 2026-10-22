import { useEffect, useId } from 'react';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { aiWash, colors, loops } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type AiMarkProps = {
  size?: number;
  /** A model is working: the mark breathes. Static otherwise and under Reduce
   *  Motion. */
  breathing?: boolean;
  /** What the mark sits on. The earth gradient is for paper; over the olive
   *  card every one of its hues is within 1.2:1 of the ground, so there the
   *  mark is solid paper — the same ink as the text beside it. */
  on?: 'paper' | 'deep';
};

/**
 * The glyph that says "a model wrote this", everywhere one did.
 *
 * A four-point sparkle with a smaller one at its shoulder — the silhouette of the
 * `sparkles` icon the app used to borrow — filled with the AI wash as one
 * diagonal gradient, olive into sage into ochre. It replaced a flat olive icon
 * because flat olive is what every *action* in this app wears, and the mark's
 * whole job is to be the one thing that is not an action.
 *
 * Decorative to a screen reader: the text beside it ("Frontline · AI-generated",
 * a block's title) carries the meaning, so the mark itself is hidden.
 */
export function AiMark({ size = 16, breathing = false, on = 'paper' }: AiMarkProps) {
  const reduced = useReducedMotion();
  const breath = useSharedValue(0);
  // SVG ids are global to the screen, and a thread shows a dozen of these.
  const id = useId().replace(/\W/g, '');

  useEffect(() => {
    // A loop has no finished frame to snap to, so Reduce Motion is handled here
    // by hand rather than by the library default.
    if (!breathing || reduced) {
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
  }, [breath, breathing, reduced]);

  const fill = on === 'deep' ? colors.textOnAccent : `url(#${id})`;
  const breathStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.get(), [0, 1], [1, 0.5]),
    transform: [{ scale: interpolate(breath.get(), [0, 1], [1, 1.12]) }],
  }));

  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, breathStyle]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          {/* User-space units, so both glyphs share one ramp across the 24-box
              rather than each compressing the whole gradient into its own bbox. */}
          <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={24} y2={24}>
            <Stop offset="0" stopColor={aiWash.olive} />
            <Stop offset="0.55" stopColor={aiWash.sage} />
            <Stop offset="1" stopColor={aiWash.ochre} />
          </LinearGradient>
        </Defs>
        <Path d={STAR} fill={fill} />
        <Path d={SPARK} fill={fill} />
      </Svg>
    </Animated.View>
  );
}

// Authored in a 24-box. The big star is centred a little low and left so the
// small one has clear air at the top right; its concave sides are cubics whose
// control points sit on the axes, which is what gives the points their draw.
const STAR = 'M11 3 C11 9 15 13 21 13 C15 13 11 17 11 23 C11 17 7 13 1 13 C7 13 11 9 11 3 Z';
const SPARK = 'M19 2 C19 3.6 20.4 5 22 5 C20.4 5 19 6.4 19 8 C19 6.4 17.6 5 16 5 C17.6 5 19 3.6 19 2 Z';
