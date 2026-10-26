import { useEffect, type ReactNode } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Glyph, PressableScale, PrimaryButton } from '@/components';
import { colors, durations, pressScale, rise, spacing } from '@/theme';
import { easings, riseIn } from '@/theme/motionPresets';
import { tapImpact } from '@/lib/haptics';

type OnboardingStepProps = {
  stepIndex: number;
  stepCount: number;
  /** The previous step, so the progress bar animates from it; -1 = the welcome. */
  previousStepIndex?: number;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  onBack?: () => void;
  onSkip?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  canContinue: boolean;
  loading?: boolean;
};

// Shared chrome for every setup step: back, step counter and progress rule,
// question, input, and a pinned Continue / Skip footer. Remounted per step.
export function OnboardingStep({
  stepIndex,
  stepCount,
  previousStepIndex,
  title,
  subtitle,
  children,
  onBack,
  onSkip,
  onContinue,
  continueLabel = 'Continue',
  canContinue,
  loading = false,
}: OnboardingStepProps) {
  // Starts at the previous step's fill so the bar eases in either direction.
  const fill = useSharedValue(
    previousStepIndex === undefined ? stepIndex / stepCount : (previousStepIndex + 1) / stepCount,
  );

  useEffect(() => {
    fill.set(
      withTiming((stepIndex + 1) / stepCount, {
        duration: durations.slow,
        easing: easings.out,
      }),
    );
  }, [fill, stepIndex, stepCount]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, fill.get() * 100))}%`,
  }));

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          {onBack ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onBack}
              scaleTo={pressScale.control}
              style={styles.backBtn}
            >
              <Glyph name="back" size={22} />
            </PressableScale>
          ) : (
            <View style={styles.backBtn} />
          )}
          <AppText variant="kicker" color="textSecondary">
            Step {String(stepIndex + 1).padStart(2, '0')} / {String(stepCount).padStart(2, '0')}
          </AppText>
        </View>

        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: stepCount, now: stepIndex + 1 }}
        >
          <Animated.View style={[styles.trackFill, fillStyle]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={riseIn(0, rise.md)}>
            <AppText variant="display" style={styles.title}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="body" color="textSecondary" style={styles.subtitle}>
                {subtitle}
              </AppText>
            ) : null}
            {children ? <View style={styles.content}>{children}</View> : null}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label={continueLabel}
            onPress={() => {
              tapImpact();
              onContinue();
            }}
            disabled={!canContinue}
            loading={loading}
          />
          {onSkip ? (
            <PressableScale
              accessibilityRole="button"
              onPress={onSkip}
              scaleTo={pressScale.chip}
              containerStyle={styles.skipSlot}
              style={styles.skip}
            >
              <AppText variant="data" color="textSecondary">
                Skip for now
              </AppText>
            </PressableScale>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  // 44pt target with the glyph on the leading edge, aligned to the gutter.
  backBtn: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  // A ruled track: hairline ink, filled with a solid olive rule.
  track: {
    height: 3,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  trackFill: { height: 3, backgroundColor: colors.accent },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  title: { marginBottom: spacing.sm, textTransform: 'uppercase' },
  subtitle: { maxWidth: 380 },
  content: { marginTop: spacing.xl },
  // For devices with no home-indicator inset.
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  skipSlot: { alignSelf: 'center' },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
});
