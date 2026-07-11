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
  display: { fontFamily: fonts.serifBold, fontSize: 32, lineHeight: 40 },
  title: { fontFamily: fonts.serifBold, fontSize: 24, lineHeight: 32 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
} as const;

export type TextVariant = keyof typeof textVariants;
