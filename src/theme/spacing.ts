import { colors } from './colors';

// One 4/8-based spacing scale, applied consistently for a calm, even rhythm.
// `xxs` (2) is the single sub-grid step, reserved for optical nudges (icon
// baseline alignment, hairline gaps) — not for layout rhythm, which stays on 4/8.
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// Corner radii — rounded, calm surfaces (no sharp or wildly varied corners).
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

// Three elevation tiers so every lifted surface reads as one system instead of
// hand-rolled shadow recipes. `sm` = resting cards, `md` = floating controls /
// framed map, `lg` = sheets & overlays. Spread a tier into a StyleSheet entry.
export const shadows = {
  sm: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  md: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lg: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export type SpacingToken = keyof typeof spacing;
export type ShadowToken = keyof typeof shadows;
