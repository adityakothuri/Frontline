import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NotConfiguredError, SupabaseRequestError } from '@/services/supabase/client';
import { colors, spacing, radii } from '@/theme';
import { AppText } from './AppText';
import { PrimaryButton } from './PrimaryButton';

type ErrorStateProps = {
  title?: string;
  message?: string;
  /** The failure itself, so the copy can say which one it was. Explicit
   *  `title`/`message` still win. */
  error?: unknown;
  onRetry?: () => void;
};

/**
 * Turn a data failure into words a veteran can act on.
 *
 * Every screen used to show one generic sentence, which told someone with no
 * signal to "try again" and someone hitting a broken backend exactly the same
 * thing. The distinction matters: one of them can fix it.
 */
export function describeDataError(error: unknown): { title: string; message: string } {
  if (error instanceof NotConfiguredError) {
    return {
      title: 'Frontline isn’t set up',
      message:
        'This copy of the app is missing its connection settings, so it can’t load resources.',
    };
  }
  if (error instanceof SupabaseRequestError) {
    return error.status >= 500
      ? {
          title: 'Our end is having trouble',
          message:
            'The problem is on our side, not yours. It’s usually brief — please try again in a moment.',
        }
      : {
          title: 'We couldn’t load this',
          message: 'Something about that request didn’t work. Please try again.',
        };
  }
  // Our AbortController fires this when the request outruns its timeout.
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      title: 'This is taking too long',
      message: 'The connection timed out. Check your signal and try again.',
    };
  }
  // React Native surfaces a failed connection as a TypeError.
  if (error instanceof TypeError) {
    return {
      title: 'You seem to be offline',
      message:
        'Frontline needs a connection to find resources near you. Check your signal and try again.',
    };
  }
  return {
    title: 'Something went wrong',
    message: 'We could not load this just now. Please try again.',
  };
}

// The error state for data-backed screens. Calm, not alarming — a muted red mark
// and a clear retry, never a red-everywhere panic screen.
export function ErrorState({ title, message, error, onRetry }: ErrorStateProps) {
  const described = describeDataError(error);
  const heading = title ?? described.title;
  const body = message ?? described.message;
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={26} color={colors.danger} />
      </View>
      <AppText variant="heading" style={styles.center}>
        {heading}
      </AppText>
      <AppText variant="body" color="textSecondary" style={styles.message}>
        {body}
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
