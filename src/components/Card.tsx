import type { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@/theme';

type CardProps = {
  children?: ReactNode;
  /** `ruled` sits on the page between rules; `panel` is a bordered surface for
   *  things that float over something else (a map, a stacked deck). */
  variant?: 'ruled' | 'panel';
  style?: StyleProp<ViewStyle>;
};

// A block of related content. No fill, radius or shadow on the page — a hairline
// below separates it from the next, so a list hangs cleanly off the masthead rule.
export function Card({ children, variant = 'ruled', style }: CardProps) {
  return <View style={[variant === 'panel' ? styles.panel : styles.ruled, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  ruled: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  panel: {
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
});
