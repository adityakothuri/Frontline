import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText, PressableScale, Skeleton } from '@/components';
import { colors, pressScale, spacing, stagger, withAlpha } from '@/theme';
import { fadeIn } from '@/theme/motionPresets';

type AiContentBlockProps = {
  /** Optional heading; omit when a surrounding section already titles the block. */
  title?: string;
  loading?: boolean;
  /** What the model is doing, shown and announced while loading. */
  loadingLabel?: string;
  /** The call behind this block failed; renders the retry state in place. */
  failed?: boolean;
  onRetry?: () => void;
  children?: ReactNode;
};

// Model output, set apart from source text by an olive left rule — nothing
// else in the app wears one. The caller owns the data and passes content,
// `loading` or `failed`.
export function AiContentBlock({
  title,
  loading = false,
  loadingLabel = 'Generating…',
  failed = false,
  onRetry,
  children,
}: AiContentBlockProps) {
  // Callers derive `loading` from "no data yet", which stays true after a
  // failure — so the retry state, not the skeletons, decides when we're waiting.
  const busy = loading && !failed;

  return (
    <View style={styles.block}>
      {title ? (
        <AppText variant="kicker" accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      {failed ? (
        <RetryState title={title} onRetry={onRetry} />
      ) : busy ? (
        <View
          style={styles.loading}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={loadingLabel}
        >
          <AppText variant="caption" color="textSecondary">
            {loadingLabel}
          </AppText>
          <Skeleton width="45%" color={BAR} />
          <Skeleton delay={stagger.pulse} color={BAR} />
          <Skeleton width="80%" delay={stagger.pulse * 2} color={BAR} />
        </View>
      ) : (
        <Animated.View entering={fadeIn()} style={styles.body}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

const BAR = withAlpha(colors.textPrimary, 0.12);

function RetryState({ title, onRetry }: { title?: string; onRetry?: () => void }) {
  const message = (
    <>
      {/* Ink, not red: red is for emergencies, and a dropped request is not one. */}
      <AppText variant="body">Couldn’t load this.</AppText>
      {onRetry ? (
        <AppText variant="data" color="accent">
          Try again ▸
        </AppText>
      ) : null}
    </>
  );

  if (!onRetry) return <View style={styles.retry}>{message}</View>;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title ? `Try loading ${title} again` : 'Try loading this again'}
      onPress={onRetry}
      scaleTo={pressScale.subtle}
      style={styles.retry}
    >
      {message}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  block: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  loading: { minHeight: 72, justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
  body: { gap: spacing.sm, marginTop: spacing.xs },
  retry: { gap: spacing.xxs, minHeight: 44, paddingVertical: spacing.sm, marginTop: spacing.xs },
});
