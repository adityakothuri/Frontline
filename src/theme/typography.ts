// Granola-inspired type system: Fraunces (characterful serif) for big display
// headers, Inter (neutral UI sans) for everything else. `fonts.*` values are the
// @expo-google-fonts export names (loaded in app/_layout.tsx); reference them via
// these tokens, never as raw strings in screens. `textVariants` is a real
// hierarchy, not random sizes.
export const fonts = {
  // Body / UI — Inter
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // Display — Fraunces serif (headlines only)
  serifSemibold: 'Fraunces_600SemiBold',
  serifBold: 'Fraunces_700Bold',
} as const;

export const textVariants = {
  // The largest statement header — reserved for onboarding welcome/complete hero
  // titles. Line height stays proportional (~1.17×) so descenders never clip.
  displayLarge: { fontFamily: fonts.serifBold, fontSize: 36, lineHeight: 42 },
  display: { fontFamily: fonts.serifBold, fontSize: 32, lineHeight: 40 },
  title: { fontFamily: fonts.serifBold, fontSize: 24, lineHeight: 32 },
  /**
   * The name of a thing on a card — a place, a category — and the stack header's
   * title, which names the thing the pushed screen is about. The third and last
   * serif step (32 / 24 / 18): it is what makes a resource card read as an entry
   * in a directory rather than a template row, and it stops here. A section
   * heading is not the name of a thing; it stays Inter.
   */
  cardTitle: { fontFamily: fonts.serifSemibold, fontSize: 18, lineHeight: 24 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
} as const;

export type TextVariant = keyof typeof textVariants;
