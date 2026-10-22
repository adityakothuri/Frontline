// Field Manual palette: manila paper, ink, one olive-drab action colour.
// Colour carries meaning (olive = action, emerald = verified, amber = check the
// source, red = emergency) and is never decorative. Contrast figures are on
// `background`. Spec: docs/obsidian/02 Design/UI Design System.md.
export const colors = {
  background: '#ECE9E0',
  backgroundElevated: '#E3DFD3', // recessed bands (tab bar, segmented tracks) — no amber/green text on it
  surface: '#F6F4EE', // sheets and input fields
  surfaceMuted: '#E3DFD3',
  border: '#D3CEC0', // hairline between rows
  rule: 'rgba(23,24,15,0.85)', // the heavy 2px rule under a masthead

  textPrimary: '#17180F', // 14.7:1
  textSecondary: '#4F4F45', // 6.8:1
  textMuted: '#64625A', // 5.0:1 — never for mono or caps text
  textOnAccent: '#F6F4EE', // 5.8:1 on accent

  accent: '#606210', // olive drab, 5.3:1
  accentPressed: '#4C4E0C',
  accentSoft: 'rgba(96,98,16,0.12)',

  danger: '#C0392B', // emergencies only
  dangerText: '#A93226',
  dangerSoft: 'rgba(192,57,43,0.12)',
  warning: '#B7791F', // unverified / outdated
  warningText: '#82540F', // 5.3:1
  warningSoft: 'rgba(183,121,31,0.14)',
  success: '#2B7230', // verified, 5.0:1
  successSoft: 'rgba(43,114,48,0.12)',

  overlay: 'rgba(23,24,15,0.45)',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * The AI identity: the one gradient in the app, and it means exactly one thing —
 * "a model wrote this". Four earth hues the palette already owns (the action
 * olive, the verified emerald, and the sage and ochre of the onboarding quartet),
 * laid down as soft radial blooms by `AiWash` and as one linear fill by `AiMark`.
 * It appears wherever AI speaks — Home's Ask card, the Ask bubbles, the guidance
 * blocks — and nowhere else: never on an action, never on a source surface,
 * never as chrome. Warm on purpose: the cool blue-to-violet wash every assistant
 * wears is the named cliché in the design rules, and this is not that product.
 *
 * Peak alphas are measured, not felt. Over the olive card (`deep`) paper text
 * stays ≥4.5:1 with emerald and sage up to 0.55 and ochre up to 0.45. Over a
 * card surface (`paper`, peak 0.14) `textSecondary` holds ≥5.7:1, and ≈5.0:1
 * inside a category-tinted guidance block; `textMuted` falls to 4.1:1 on
 * surface and ≈3.5:1 in the block — small text on a washed surface uses
 * `textSecondary`, and nothing on it is red.
 */
export const aiWash = {
  olive: '#5F7326',
  sage: '#4E7D5B',
  emerald: '#2E7D32',
  ochre: '#A56E24',
} as const;

// Per-step icon accents for onboarding. A small quartet of four DISTINCT earth
// hues (sage · taupe · ochre · clay) so each step reads differently while staying
// on-palette — replaces the off-palette blues/teals that were hardcoded in the
// screen. Deliberately avoids the olive brand `accent` (`colors.accent`) so a step icon
// never looks like a primary action. Kept out of `colors` so `ColorToken` stays
// a flat string map.
export const onboardingAccents = {
  location: '#4E7D5B', // sage green
  role: '#8A6A48', // warm taupe
  documents: '#A56E24', // amber ochre
  radius: '#9C5D3B', // clay / terracotta
} as const;

/** Build a translucent version of a solid hex color (e.g. for soft category tints). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
