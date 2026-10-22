import { View, StyleSheet } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PrimaryButton } from '@/components';
import { colors, durations, radii, rise, spacing, stagger, withAlpha } from '@/theme';
import { riseIn } from '@/theme/motionPresets';

// The first thing a new veteran sees: a warm, confident welcome that sets the
// tone before the setup questions. The mark lands first, then the words arrive
// under it one beat apart. Reduce Motion resolves every one of these to its
// finished frame, which the library does for us.
export function OnboardingWelcome({ onStart }: { onStart: () => void }) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.markWrap}>
          <View style={styles.halo} />
          <Animated.View
            entering={ZoomIn.duration(durations.slow).withInitialValues({
              transform: [{ scale: 0.85 }],
            })}
            style={styles.mark}
          >
            <Ionicons name="compass" size={42} color={colors.textOnAccent} />
          </Animated.View>
        </View>

        <Animated.View entering={riseIn(stagger.step, rise.md)}>
          <AppText variant="display" style={styles.title}>
            Welcome to Frontline
          </AppText>
        </Animated.View>

        <Animated.View entering={riseIn(stagger.step * 2, rise.md)}>
          <AppText variant="body" color="textSecondary" style={styles.subtitle}>
            Benefits, local help, and a clear next step — found for you, explained in plain English.
            You served; this part should be simpler.
          </AppText>
        </Animated.View>
      </View>

      <Animated.View entering={riseIn(stagger.step * 3, rise.md)} style={styles.footer}>
        <PrimaryButton label="Let's get started" onPress={onStart} />
        <View style={styles.reassure}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted">
            No sign-in · nothing sensitive · about 2 minutes
          </AppText>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  markWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  halo: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: radii.sm,
    backgroundColor: withAlpha(colors.accent, 0.12),
  },
  mark: {
    width: 88,
    height: 88,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  title: { textAlign: 'center', marginBottom: spacing.md },
  subtitle: { textAlign: 'center', maxWidth: 320 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md },
  reassure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
