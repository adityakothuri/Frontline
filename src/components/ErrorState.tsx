import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NotConfiguredError, SupabaseRequestError } from '@/services/supabase/client';
import { colors, rise, spacing, radii } from '@/theme';
import { riseIn } from '@/theme/motionPresets';
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
  // React Native surfaces a failed connection as a TypeError — which covers a
  // phone with no signal *and* a service that is not answering. The copy used to
  // assume the first ("You seem to be offline"), which told a veteran with full
  // bars that their connection was the problem.
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

// The error state for data-backed screens. Calm, not alarming — a muted red mark
// and a clear retry, never a red-everywhere panic screen.
export function ErrorState({ title, message, error, onRetry }: ErrorStateProps) {
  const described = describeDataError(error);
  const heading = title ?? described.title;
  const body = message ?? described.message;
  return (
    <Animated.View entering={riseIn(0, rise.md)} style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  // 64, the same disc as `EmptyState`: the two states are siblings and were a
  // different size for no reason anyone could name.
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: 300 },
  action: { marginTop: spacing.lg, paddingHorizontal: spacing.xxl },
});
