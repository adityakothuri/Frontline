import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

type LoadingProps = {
  label?: string;
};

// The loading state every data-backed screen shows before content arrives.
export function Loading({ label }: LoadingProps) {
  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.accent} />
      {label ? (
        <AppText variant="body" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  label: { textAlign: 'center' },
});
