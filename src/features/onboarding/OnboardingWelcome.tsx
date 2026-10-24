import { View, StyleSheet } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, PrimaryButton } from '@/components';
import { colors, spacing } from '@/theme';
import { ruleDraw } from '@/theme/motionPresets';

// The first thing a new veteran sees, set like the title page of a field guide:
// the name, what it does, one rule, one way forward.
export function OnboardingWelcome({ onStart }: { onStart: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <AppText variant="kicker" color="textSecondary">
          Frontline
        </AppText>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          Find your next step.
        </AppText>
        <Animated.View entering={reduceMotion ? undefined : ruleDraw} style={styles.rule} />
        <AppText variant="body" color="textSecondary" style={styles.subtitle}>
          Benefits, local help, and a clear next step — found for you, explained in plain English.
          You served; this part should be simpler.
        </AppText>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="Let's get started" onPress={onStart} />
        <AppText variant="kicker" color="textSecondary" style={styles.reassure}>
          No sign-in · nothing sensitive · 2 min
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  title: { fontSize: 52, lineHeight: 52, textTransform: 'uppercase' },
  rule: {
    height: 2,
    backgroundColor: colors.rule,
    marginVertical: spacing.sm,
    transformOrigin: 'left',
  },
  subtitle: { maxWidth: 360 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md },
  reassure: { textAlign: 'center' },
});
