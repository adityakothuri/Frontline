import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  SlideOutLeft,
  SlideOutRight,
  ZoomIn,
} from 'react-native-reanimated';
import { durations, rise, springs, stagger } from './motion';

/**
 * The half of the motion system that needs Reanimated, kept apart from
 * `motion.ts` because that module has to stay importable from a node test.
 * Deliberately **not** re-exported through `src/theme/index.ts` for the same
 * reason — import it directly:
 *
 *     import { easings, riseIn } from '@/theme/motionPresets';
 */

/**
 * The house curves. Things arrive decelerating and leave accelerating, which is
 * also why every exit in this app is shorter than its matching entrance.
 */
export const easings = {
  out: Easing.out(Easing.cubic),
  in: Easing.in(Easing.cubic),
  inOut: Easing.inOut(Easing.cubic),
  /** Constant rate. Only for loops whose wrap has to be seamless. */
  linear: Easing.linear,
} as const;

/**
 * Nothing below sets `.reduceMotion()`, on purpose. Reanimated's builders default
 * to `ReduceMotion.System`, and on Reduce Motion they assign the target value
 * directly — they snap to the finished frame, which is exactly the degrade this
 * project requires. This was once an exported `REDUCE_MOTION_DEFAULT` constant
 * that no call site ever passed; a documented default is a comment, not an API.
 */

/** Caps a stagger so a late sibling never lags the entrance it belongs to. */
export const stepDelay = (index: number) => Math.min(index * stagger.step, stagger.max);

/**
 * The standard arrival: fade up over `distance`. This is the app's one entrance
 * idiom — a screen's sections, a list's first rows and a detail page's hero all
 * use it, varying only the distance (proportional to the element's size) and the
 * delay (its place in the order).
 */
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

/**
 * A spring arrival, for the one or two things that should feel physical rather
 * than timed. Two call sites, and the count is the point: a card thrown up by a
 * tapped map pin, and Home's start card — the object that screen exists to
 * offer, which should arrive with weight rather than fade up like a paragraph.
 * Damped to the same floor as every other spring in the app, so it settles
 * rather than bounces.
 */
export const settleIn = (distance: number = rise.lg) =>
  FadeInDown.springify()
    .duration(springs.settle.duration)
    .dampingRatio(springs.settle.dampingRatio)
    .withInitialValues({ transform: [{ translateY: distance }] });

/**
 * A card rising from a stack into the place the one in front of it just left —
 * the Home review deck's handoff.
 *
 * This is deliberately an *entrance*, not a promotion animation on the card
 * behind, and that is the whole trick. The peek's resting state and the front
 * slot's resting state differ only by `offset` and `dim`, so a card that enters
 * *from* those values and settles to identity is indistinguishable from one that
 * was animated forward — while being immune to the frame on which React happens
 * to commit the shorter list. The previous imperative version reset four shared
 * values from the JS thread ahead of that commit and flashed the answered card
 * back onto the screen for as long as the two pipelines disagreed.
 *
 * The caller passes its own peek constants so there is exactly one source of
 * truth for them: if these two numbers ever drift from the peek's real style,
 * the handoff visibly jumps.
 */
export const promoteIn = (offset: number, dim: number) =>
  FadeInDown.springify()
    .duration(springs.settle.duration)
    .dampingRatio(springs.settle.dampingRatio)
    .withInitialValues({ opacity: dim, transform: [{ translateY: offset }] });

/**
 * A card leaving to the side it was voted — right for helpful, left for not — so
 * the direction repeats the answer rather than decorating it.
 *
 * `SlideOut*`, not `FadeOut*`: the fade variants translate a hard-coded 25pt,
 * which on a full-width card is a 7.6% drift, and under the house exit curve
 * (accelerating) nine tenths of that happens in the last eighty milliseconds. It
 * read as a blink-out, not a throw, and the direction — the entire point, since
 * it repeats the veteran's answer — never registered. The slide builders travel
 * the window width, so `easings.in` now has something to accelerate through.
 *
 * Stock builders rather than a hand-rolled `Keyframe` so Reduce Motion stays the
 * library's job: on a custom exit function it would be ours, and this app's rule
 * is that reduced motion lands on the finished frame, not that it is skipped.
 */
export const throwOut = (direction: 1 | -1) =>
  (direction > 0 ? SlideOutRight : SlideOutLeft).duration(durations.slow).easing(easings.in);

/** The medallion size on a resource card, and on the detail hero it opens into. */
const CARD_MEDALLION = 44;
const DETAIL_MEDALLION = 36;

/**
 * Continuity between a resource card and the page it opens.
 *
 * Framework shared-element transitions are not an option here — Reanimated's own
 * docs call them experimental, and they require `detachInactiveScreens={false}`
 * on the tab navigator, which would keep the native map view alive on every tab.
 * So instead of moving one view between screens, the hero's medallion simply
 * *arrives at the size the card's was* and settles to its own. Same hue, same
 * glyph, same shape, same weight — which is the part the eye actually reads as
 * continuity.
 */
export const heroMedallionIn = () =>
  ZoomIn.springify()
    .duration(springs.settle.duration)
    .dampingRatio(springs.settle.dampingRatio)
    .withInitialValues({ transform: [{ scale: CARD_MEDALLION / DETAIL_MEDALLION }] });
