import { View, StyleSheet } from 'react-native';
import { NotConfiguredError, SupabaseRequestError } from '@/services/supabase/client';
import { spacing } from '@/theme';
import { AppText } from './AppText';
import { TextAction } from './TextAction';

type ErrorStateProps = {
  title?: string;
  message?: string;
  /** The failure, so the copy can name it. Explicit `title`/`message` win. */
  error?: unknown;
  onRetry?: () => void;
};

/** Turn a data failure into words a veteran can act on (offline vs our fault). */
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
  // RN reports a failed connection as a TypeError for both no signal and a
  // service not answering, so the copy must not blame the veteran's connection.
  if (error instanceof TypeError) {
    return {
      title: 'We couldn’t reach Frontline',
      message:
        'Our service didn’t answer. Check your connection and try again in a moment — if your signal is fine, the problem is on our side.',
    };
  }
  return {
    title: 'Something went wrong',
    message: 'We could not load this just now. Please try again.',
  };
}

// The error state for data-backed screens: the same plain shape as an empty
// state. No red — a failed load is not an emergency.
export function ErrorState({ title, message, error, onRetry }: ErrorStateProps) {
  const described = describeDataError(error);
  return (
    <View style={styles.root}>
      <AppText variant="kicker" accessibilityRole="header">
        {title ?? described.title}
      </AppText>
      <AppText variant="body" color="textSecondary">
        {message ?? described.message}
      </AppText>
      {onRetry ? <TextAction label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No rule of its own: it sits under a masthead that already has one.
  root: { gap: spacing.sm, paddingTop: spacing.sm },
});
