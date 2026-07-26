import { useEffect, useState, type ReactNode } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PrimaryButton } from '@/components';
import { colors, radii, spacing, withAlpha } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type OnboardingStepProps = {
  stepIndex: number;
  stepCount: number;
  /** The step shown before this one, so the progress bar animates from where it
   * actually was — in both directions. -1 means "came from the welcome". */
  previousStepIndex?: number;
  icon: IconName;
  /** Tint for the hero icon; defaults to the olive accent. */
  iconColor?: string;
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

// The shared chrome for every setup step: a progress bar + back control, an
// icon hero, the prompt, the step's input, and a pinned Continue / Skip footer.
// Content springs in on each step (keyed remount in the wizard).
export function OnboardingStep({
  stepIndex,
  stepCount,
  previousStepIndex,
  icon,
  iconColor = colors.accent,
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
  const [anim] = useState(() => new Animated.Value(0));
  // Starts at the previously shown step's fill so the bar eases into place on
  // each remount — forward or back. Width % needs the JS driver; it's a 4px bar.
  const [fill] = useState(
    () =>
      new Animated.Value(
        previousStepIndex === undefined
          ? stepIndex / stepCount
          : (previousStepIndex + 1) / stepCount,
      ),
  );

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      if (reduce) {
        anim.setValue(1);
        fill.setValue((stepIndex + 1) / stepCount);
      } else {
        Animated.timing(anim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
        Animated.timing(fill, {
          toValue: (stepIndex + 1) / stepCount,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }
    });
    return () => {
      active = false;
    };
  }, [anim, fill, stepIndex, stepCount]);

  const bodyStyle = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };
  const fillWidth = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onBack}
              hitSlop={10}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          <AppText variant="caption" color="textMuted">
            Step {stepIndex + 1} of {stepCount}
          </AppText>
        </View>

        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: stepCount, now: stepIndex + 1 }}
        >
          <Animated.View style={[styles.trackFill, { width: fillWidth }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={bodyStyle}>
            <View style={[styles.hero, { backgroundColor: withAlpha(iconColor, 0.14) }]}>
              <Ionicons name={icon} size={30} color={iconColor} />
            </View>
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
            onPress={onContinue}
            disabled={!canContinue}
            loading={loading}
          />
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              onPress={onSkip}
              hitSlop={8}
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            >
              <AppText variant="label" color="textMuted">
                Skip for now
              </AppText>
            </Pressable>
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
  backBtn: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  track: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    marginHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  trackFill: { height: 4, borderRadius: radii.pill, backgroundColor: colors.accent },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  hero: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { marginBottom: spacing.sm },
  subtitle: { maxWidth: 380 },
  content: { marginTop: spacing.xl },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
  skip: { alignSelf: 'center', paddingVertical: spacing.xs },
  pressed: { opacity: 0.6 },
});
