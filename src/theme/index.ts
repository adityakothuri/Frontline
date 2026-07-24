import { colors } from './colors';
import { spacing, radii } from './spacing';
import { fonts, textVariants } from './typography';

export { colors, spacing, radii, fonts, textVariants };
export { withAlpha } from './colors';
export type { ColorToken } from './colors';
export type { SpacingToken } from './spacing';
export type { TextVariant } from './typography';

// Aggregate token object for when a screen wants the whole theme in one import.
export const theme = { colors, spacing, radii, fonts, textVariants } as const;
export type Theme = typeof theme;
