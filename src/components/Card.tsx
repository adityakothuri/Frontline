import type { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@/theme';

type CardProps = {
  /** Optional, so the surface can also be used empty — the Home review deck
   *  draws the card behind the top one as a bare shell. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

// A single quiet surface: hairline border plus a whisper of shadow so cards
// lift just off the paper (never heavy, never card-in-card) per the design system.
export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
