import { colors } from './colors';
import { spacing, radii, shadows } from './spacing';
import { fonts, textVariants } from './typography';

export { colors, spacing, radii, shadows, fonts, textVariants };
export { withAlpha, onboardingAccents } from './colors';
export { categoryVisual, medallionStyle, surfaceTint } from './categoryVisual';
export type { ColorToken } from './colors';
export type { SpacingToken, ShadowToken } from './spacing';
export type { TextVariant } from './typography';
export type { CategoryVisual } from './categoryVisual';

// Aggregate token object for when a screen wants the whole theme in one import.
export const theme = { colors, spacing, radii, shadows, fonts, textVariants } as const;
export type Theme = typeof theme;
