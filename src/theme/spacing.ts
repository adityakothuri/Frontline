// One 4/8-based spacing scale, applied consistently for a calm, even rhythm.
export const spacing = {
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

export type SpacingToken = keyof typeof spacing;
