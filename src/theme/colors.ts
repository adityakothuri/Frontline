// Frontline color tokens — dark, calm, premium. Color carries MEANING here:
// green = verified/confirmed, amber = unverified/outdated, red = emergency only.
// Never decorative. Direction: docs/obsidian/02 Design/UI Design System.md.
export const colors = {
  // Foundation — tinted dark navy/charcoal (never pure black)
  background: '#0B1220',
  backgroundElevated: '#0F1826',

  // Surfaces — quiet muted cards sitting on the foundation
  surface: '#151E2C',
  surfaceMuted: '#1B2536',
  border: '#26303F',

  // Text
  textPrimary: '#F4F7FB',
  textSecondary: '#9BA8BC',
  textMuted: '#7A8699', // WCAG AA (>=4.5:1) on all app surfaces for small text
  textOnAccent: '#0B1220',

  // Accent — one restrained, trustworthy blue, for primary actions only
  accent: '#4C8DFF',
  accentPressed: '#3A6FD0',
  accentSoft: 'rgba(76,141,255,0.14)',

  // Semantic — used for meaning, never as chrome
  danger: '#F0554A', // red — emergencies only
  dangerSoft: 'rgba(240,85,74,0.14)',
  warning: '#F5A623', // amber — unverified / outdated / caution
  warningSoft: 'rgba(245,166,35,0.14)',
  success: '#34C759', // green — verified / confirmed
  successSoft: 'rgba(52,199,89,0.14)',

  // Utility
  overlay: 'rgba(7,12,22,0.72)',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
