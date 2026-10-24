import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  SlideOutLeft,
  SlideOutRight,
  withTiming,
} from 'react-native-reanimated';
import { durations, rise, springs, stagger } from './motion';

// The half of the motion system that needs Reanimated. Not re-exported from
// `@/theme` so that barrel stays importable from node tests.
//
// Nothing here sets `.reduceMotion()`: Reanimated's builders default to
// `ReduceMotion.System`, which snaps to the finished frame — the degrade this
// project wants.

/** Things arrive decelerating and leave accelerating. */
export const easings = {
  out: Easing.out(Easing.cubic),
  in: Easing.in(Easing.cubic),
  /** Constant rate. Only for loops whose wrap has to be seamless. */
  linear: Easing.linear,
} as const;

/** Caps a stagger so a late sibling never lags the entrance it belongs to. */
export const stepDelay = (index: number) => Math.min(index * stagger.step, stagger.max);

/** The standard arrival: fade up over `distance` (proportional to the element's size). */
export const riseIn = (delay = 0, distance: number = rise.sm) =>
  FadeInDown.duration(durations.base)
    .easing(easings.out)
    .delay(delay)
    .withInitialValues({ transform: [{ translateY: distance }] });

/** An arrival with no travel — for something already in the right place. */
export const fadeIn = (delay = 0, duration: number = durations.base) =>
  FadeIn.duration(duration).easing(easings.out).delay(delay);

/** Leaving. Always quicker than arriving. */
export const fadeOut = (duration: number = durations.fast) =>
  FadeOut.duration(duration).easing(easings.in);

/** Leaving downward — the counterpart to `riseIn`, for a card that came up. */
export const sinkOut = (duration: number = durations.fast) =>
  FadeOutDown.duration(duration).easing(easings.in);

/** A spring arrival, reserved for the place card a tapped map pin throws up. */
export const settleIn = (distance: number = rise.lg) =>
  FadeInDown.springify()
    .duration(springs.settle.duration)
    .dampingRatio(springs.settle.dampingRatio)
    .withInitialValues({ transform: [{ translateY: distance }] });

/**
 * The Home review deck's handoff: the next card *enters from* the peek's
 * `offset` and `dim` rather than being animated forward, so it cannot race the
 * commit that shortens the list. The caller passes its own peek constants; if
 * they drift from the peek's real style the handoff visibly jumps.
 */
export const promoteIn = (offset: number, dim: number) =>
  FadeInDown.springify()
    .duration(springs.settle.duration)
    .dampingRatio(springs.settle.dampingRatio)
    .withInitialValues({ opacity: dim, transform: [{ translateY: offset }] });

/**
 * A card leaving to the side it was voted (right = helpful). `SlideOut*` rather
 * than `FadeOut*`, whose fixed 25pt drift reads as a blink-out; stock builders
 * keep Reduce Motion handling with the library.
 */
export const throwOut = (direction: 1 | -1) =>
  (direction > 0 ? SlideOutRight : SlideOutLeft).duration(durations.slow).easing(easings.in);

/**
 * The masthead rule drawing itself left to right — the one signature entrance.
 * A custom worklet, so it does not get Reanimated's automatic Reduce Motion
 * snap: callers skip it when `useReducedMotion()` is on. The animated view needs
 * `transformOrigin: 'left'`.
 */
export const ruleDraw = () => {
  'worklet';
  return {
    initialValues: { transform: [{ scaleX: 0 }] },
    animations: {
      transform: [{ scaleX: withTiming(1, { duration: durations.reveal, easing: easings.out }) }],
    },
  };
};
