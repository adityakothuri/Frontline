// Field Manual palette: manila paper, ink, one olive-drab action colour.
// Colour carries meaning (olive = action, emerald = verified, amber = check the
// source, red = emergency) and is never decorative. Contrast figures are on
// `background`.
export const colors = {
  background: '#ECE9E0',
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

/** Build a translucent version of a solid hex color (e.g. for soft category tints). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
