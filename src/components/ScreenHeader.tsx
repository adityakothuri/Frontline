import { View, StyleSheet } from 'react-native';
import { spacing } from '@/theme';
import { AppText } from './AppText';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
};

// Consistent top-of-screen title block shared by every tab, so each screen reads
// as one clear purpose (UX principle 1).
export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  return (
    <View style={styles.root}>
      <AppText variant="title">{title}</AppText>
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
  subtitle: { marginTop: spacing.xs },
});
