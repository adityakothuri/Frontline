import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText, PressableScale, Skeleton } from '@/components';
import { colors, pressScale, spacing, stagger, timings, withAlpha } from '@/theme';
import { fadeIn } from '@/theme/motionPresets';

/**
 * Frontline's turn while a (non-streamed) reply is pending. The label changes at
 * `timings.askPatience` and twice that, so a long wait does not read as stalled.
 */
export function ThinkingRow({ zip }: { zip?: string }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const second = setTimeout(() => setStage(1), timings.askPatience);
    const third = setTimeout(() => setStage(2), timings.askPatience * 2);
    return () => {
      clearTimeout(second);
      clearTimeout(third);
    };
  }, []);

  const label =
    stage === 0
      ? 'Thinking…'
      : stage === 1
        ? zip
          ? `Looking at what's near ${zip}…`
          : 'Working on it…'
        : 'Almost there…';

  // Android hears the live region below; iOS must be told.
  useEffect(() => {
    if (stage === 0 || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(label);
  }, [stage, label]);

  return (
    <Animated.View
      entering={fadeIn()}
      style={styles.turn}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Frontline is writing a reply. ${label}`}
    >
      <AppText variant="kicker" color="accent">
        Frontline
      </AppText>
      <Animated.View key={label} entering={fadeIn()}>
        <AppText variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
          {label}
        </AppText>
      </Animated.View>
      <Skeleton width="72%" color={BAR} />
      <Skeleton width="46%" color={BAR} delay={stagger.pulse} />
    </Animated.View>
  );
}

const BAR = withAlpha(colors.textPrimary, 0.12);

/** A turn that failed: the reason, and the one way forward. No red — red is for
 *  emergencies, and a dropped request is not one. */
export function ChatErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.turn}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${message} Try again`}
        onPress={onRetry}
        scaleTo={pressScale.subtle}
        style={styles.retry}
      >
        <AppText variant="body">{message}</AppText>
        <AppText variant="data" color="accent">
          Try again ▸
        </AppText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  turn: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingLeft: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  retry: { gap: spacing.xs, minHeight: 44 },
});
