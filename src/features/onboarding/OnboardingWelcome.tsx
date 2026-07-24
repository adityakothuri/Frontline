import { useEffect, useRef } from 'react';
import { View, Animated, Easing, AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PrimaryButton } from '@/components';
import { colors, radii, spacing, withAlpha } from '@/theme';

// The first thing a new veteran sees: a warm, confident welcome that sets the
// tone before the setup questions. One driver animates a staggered entrance.
export function OnboardingWelcome({ onStart }: { onStart: () => void }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      if (reduce) {
        t.setValue(1);
      } else {
        Animated.timing(t, {
          toValue: 1,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
    return () => {
      active = false;
    };
  }, [t]);

  // Staggered reveal from a single 0→1 driver: each element eases over its own slice.
  const slice = (from: number, to: number) => {
    const opacity = t.interpolate({ inputRange: [from, to], outputRange: [0, 1], extrapolate: 'clamp' });
    const translateY = t.interpolate({ inputRange: [from, to], outputRange: [18, 0], extrapolate: 'clamp' });
    return { opacity, transform: [{ translateY }] };
  };
  const markStyle = {
    opacity: t.interpolate({ inputRange: [0, 0.45], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      { scale: t.interpolate({ inputRange: [0, 0.45], outputRange: [0.85, 1], extrapolate: 'clamp' }) },
    ],
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.markWrap}>
          <View style={styles.halo} />
          <Animated.View style={[styles.mark, markStyle]}>
            <Ionicons name="compass" size={42} color={colors.textOnAccent} />
          </Animated.View>
        </View>

        <Animated.View style={slice(0.15, 0.6)}>
          <AppText variant="display" style={styles.title}>
            Welcome to Frontline
          </AppText>
        </Animated.View>

        <Animated.View style={slice(0.3, 0.75)}>
          <AppText variant="body" color="textSecondary" style={styles.subtitle}>
            Find your next step — benefits, local resources, and a clear plan for what to do next.
          </AppText>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, slice(0.5, 1)]}>
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
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.accent, 0.12),
  },
  mark: {
    width: 88,
    height: 88,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  title: { textAlign: 'center', fontSize: 36, lineHeight: 42, marginBottom: spacing.md },
  subtitle: { textAlign: 'center', maxWidth: 320 },
  footer: { paddingHorizontal: spacing.xl, gap: spacing.md },
  reassure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
