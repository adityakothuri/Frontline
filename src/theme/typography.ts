// Three families, one job each: Barlow Condensed names things, Public Sans
// carries prose, IBM Plex Mono carries data (labels, numbers, dates, statuses).
// `fonts.*` are the @expo-google-fonts export names loaded in app/_layout.tsx.
export const fonts = {
  regular: 'PublicSans_400Regular',
  medium: 'PublicSans_500Medium',
  semibold: 'PublicSans_600SemiBold',
  displaySemibold: 'BarlowCondensed_600SemiBold',
  display: 'BarlowCondensed_700Bold',
  mono: 'IBMPlexMono_500Medium',
} as const;

export const textVariants = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  /** The name of a place or category. */
  itemTitle: { fontFamily: fonts.displaySemibold, fontSize: 21, lineHeight: 24 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  /** Section numbers and small headers: `01  NEAR YOU`. */
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  /** Distances, dates, counts, statuses, text actions. */
  data: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
} as const;

export type TextVariant = keyof typeof textVariants;
