// Frontline color tokens — warm "paper" light theme (Granola-inspired). Color
// carries MEANING here: deep-emerald green = verified/confirmed, amber =
// unverified/outdated, red = emergency only; muted olive accent = primary
// action. Never decorative. Direction: docs/obsidian/02 Design/UI Design System.md.
export const colors = {
  // Foundation — warm off-white "near-paper" (never pure white)
  background: '#F5F1E8',
  backgroundElevated: '#EFEADD',

  // Surfaces — soft paper cards lifting off the foundation
  surface: '#FBF8F0',
  surfaceMuted: '#EDE8DA',
  border: '#DED8C7',

  // Text — warm near-black on paper
  textPrimary: '#1A1A17',
  textSecondary: '#57564F',
  textMuted: '#6F6D63', // AA (>=4.5:1) on background/surface; only 4.24:1 on surfaceMuted — use textSecondary there for small text
  textOnAccent: '#FBF8F0', // warm paper-white on olive (5.0:1)

  // Accent — a real olive green (high chroma, never gray), primary actions only.
  // 4.7:1 as text/icons on the background; textOnAccent passes AA on top of it.
  accent: '#5F7326',
  accentPressed: '#4C5C1E',
  accentSoft: 'rgba(95,115,38,0.14)',

  // Semantic — used for meaning, never as chrome
  danger: '#C0392B', // red — emergencies only
  dangerText: '#A93226', // red as *text* — >=4.5:1 on the danger-tinted banners
  dangerSoft: 'rgba(192,57,43,0.12)',
  warning: '#B7791F', // amber — unverified / outdated / caution (dots + icons)
  warningText: '#8F5D16', // amber as *text* — >=4.5:1 on all paper surfaces
  warningSoft: 'rgba(183,121,31,0.14)',
  success: '#2E7D32', // deep emerald — verified / confirmed (distinct from the olive accent)
  successSoft: 'rgba(46,125,50,0.12)',

  // Utility
  overlay: 'rgba(26,26,23,0.45)',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;

/** Build a translucent version of a solid hex color (e.g. for soft category tints). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
