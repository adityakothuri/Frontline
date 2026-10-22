import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { AiMark, AiWash, AppText, PressableScale, Skeleton } from '@/components';
import { colors, pressScale, radii, shadows, spacing, stagger, timings, withAlpha } from '@/theme';
import { fadeIn, riseIn } from '@/theme/motionPresets';

/**
 * Frontline's bubble while it is still writing.
 *
 * Nothing streams, so a reply is a 3–8 s wait with a blank where the answer
 * goes. The bubble wears the reply's own chrome with the wash set live and the
 * mark breathing — the AI surface visibly working, the same two tells the
 * guidance blocks give — the skeleton bars ripple (Reduce Motion handled by
 * `Skeleton`), and the label changes once at `timings.askPatience` and once
 * more at twice that — a label that changes reads as work in progress where a
 * static one reads as stalled.
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
    stage === 0 ? 'Thinking…' : stage === 1 ? (zip ? `Looking at what's near ${zip}…` : 'Working on it…') : 'Almost there…';

  // The label is the wait's only news. Android hears it through the live
  // region below; iOS has to be told.
  useEffect(() => {
    if (stage === 0 || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(label);
  }, [stage, label]);

  return (
    <Animated.View entering={riseIn()} style={styles.row}>
      <View
        style={styles.bubble}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Frontline is writing a reply. ${label}`}
      >
        <AiWash tone="paper" live style={styles.corners} />
        <View style={styles.header}>
          <AiMark size={14} breathing />
          <Animated.View key={label} entering={fadeIn()}>
            <AppText variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
              {label}
            </AppText>
          </Animated.View>
        </View>
        <Skeleton width="72%" color={withAlpha(colors.accent, 0.34)} />
        <Skeleton width="46%" color={withAlpha(colors.accent, 0.34)} delay={stagger.pulse} />
      </View>
    </Animated.View>
  );
}

/** A turn that failed: the reason, and the one way forward. It sits in the
 *  assistant's slot and wears the assistant's chrome. No red anywhere — red is
 *  for emergencies, and a dropped request is not one. */
export function ChatErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Animated.View entering={riseIn()} style={styles.row}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${message} Try again`}
        onPress={onRetry}
        scaleTo={pressScale.subtle}
        style={styles.retry}
      >
        <AppText variant="body">{message}</AppText>
        <AppText variant="label" color="accentPressed">
          Tap to try again
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start' },
  bubble: {
    width: '72%',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderBottomLeftRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(colors.accent, 0.45),
    padding: spacing.lg,
    ...shadows.sm,
  },
  corners: { borderRadius: radii.lg, borderBottomLeftRadius: radii.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 16 },
  retry: {
    gap: spacing.xs,
    minHeight: 44,
    maxWidth: '92%',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderBottomLeftRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.sm,
  },
});
