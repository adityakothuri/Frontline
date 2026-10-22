import { colors } from './colors';
import { spacing, radii, shadows } from './spacing';
import { fonts, textVariants } from './typography';
import { durations, loops, timings, springs, stagger, rise, pressScale } from './motion';

export { colors, spacing, radii, shadows, fonts, textVariants };
export {
  durations,
  loops,
  timings,
  springs,
  stagger,
  rise,
  pressScale,
  MIN_DAMPING_RATIO,
} from './motion';
export type { DurationToken, SpringToken } from './motion';
export { aiWash, withAlpha, onboardingAccents } from './colors';
export { categoryVisual, medallionStyle, surfaceTint } from './categoryVisual';
export type { ColorToken } from './colors';
export type { SpacingToken, ShadowToken } from './spacing';
export type { TextVariant } from './typography';
export type { CategoryVisual } from './categoryVisual';

// Aggregate token object for when a screen wants the whole theme in one import.
// The easing curves are the one deliberate omission — they need Reanimated, and
// this barrel has to stay importable from the node test environment. Import them
// from '@/theme/motionPresets' instead.
export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  fonts,
  textVariants,
  durations,
  loops,
  timings,
  springs,
  stagger,
  rise,
  pressScale,
} as const;
export type Theme = typeof theme;
