import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '@/theme';
import { AppText } from './AppText';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Optional trailing control (e.g. an icon button) aligned to the title's right edge. */
  action?: ReactNode;
};

// Consistent top-of-screen title block shared by every tab, so each screen reads
// as one clear purpose (UX principle 1).
export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <AppText variant="title" style={styles.title}>
          {title}
        </AppText>
        {action}
      </View>
      {subtitle ? (
        <AppText variant="body" color="textSecondary" style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: spacing.xl },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { flexShrink: 1 },
  subtitle: { marginTop: spacing.xs },
});
