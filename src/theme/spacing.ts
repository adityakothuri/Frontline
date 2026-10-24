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

// Crisp corners, never a pill: `xs` for small marks (a checkbox, a map dot), `sm`
// for fields, buttons and chips, `md` for cards and sheets. Past ~10 a bordered
// card starts to read as a rounded-card template.
export const radii = {
  none: 0,
  xs: 3,
  sm: 6,
  md: 10,
} as const;

// Only the bottom sheet lifts off the page — it has to read over a live map.
// Everything else is separated by rules, not elevation.
export const shadows = {
  sheet: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
} as const;
