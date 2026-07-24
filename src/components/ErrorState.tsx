import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, radii } from '@/theme';
import { AppText } from './AppText';
import { PrimaryButton } from './PrimaryButton';

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

// The error state for data-backed screens. Calm, not alarming — a muted red mark
// and a clear retry, never a red-everywhere panic screen.
export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this just now. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={26} color={colors.danger} />
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" style={styles.message}>
        {message}
      </AppText>
      {onRetry ? (
        <PrimaryButton
          label="Try again"
          onPress={onRetry}
          variant="secondary"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: 300 },
  action: { marginTop: spacing.lg, paddingHorizontal: spacing.xxl },
});
