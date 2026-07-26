import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, EmptyState, LocationButton, ScreenContainer } from '@/components';
import { useProfile } from '@/services/profile';
import { useActivity } from '@/services/activity';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { timeGreeting } from '@/lib/greeting';
import { dailyHomeMessage } from '@/lib/homeMessages';
import { colors, radii, shadows, spacing, surfaceTint } from '@/theme';
import { ReviewPrompt } from '@/features/home/ReviewPrompt';

// The front door: a warm, personal landing. A soft olive-washed hero panel with
// the brand mark, greeting, and a message — then a prompt to rate the last
// opportunity you engaged with, or a nudge to go explore.
export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { pendingReview, isHydrated } = useActivity();
  const reduced = useReducedMotion();

  const greeting = profile?.firstName
    ? `${timeGreeting()}, ${profile.firstName}`
    : timeGreeting();

  // One quiet fade so the front door settles in rather than snapping (a single
  // element, not an orchestrated sequence). Instant under reduce-motion.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      fade.setValue(1);
      return;
    }
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fade, reduced]);

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <LocationButton zip={profile?.zip} onPress={() => router.navigate('/profile')} />
      </View>
      <Animated.View style={{ opacity: fade }}>
        <View style={styles.hero}>
          <View style={styles.mark}>
            <Ionicons name="compass" size={22} color={colors.accent} />
          </View>
          <AppText variant="display">{greeting}</AppText>
          <AppText variant="body" color="textSecondary" style={styles.subtitle}>
            {dailyHomeMessage()}
          </AppText>
          {profile?.zip ? (
            <View style={styles.zipRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              {/* textSecondary keeps AA on the olive-washed hero panel. */}
              <AppText variant="caption" color="textSecondary">
                Showing help near {profile.zip}
              </AppText>
            </View>
          ) : null}
        </View>
      </Animated.View>

      {!isHydrated ? null : pendingReview ? (
        <ReviewPrompt engagement={pendingReview} />
      ) : (
        <View style={styles.empty}>
          <EmptyState
            icon="sparkles-outline"
            title="Nothing to see here yet"
            message="Once you check out an opportunity, you can come back to rate it. Ready to find some help?"
            actionLabel="Explore help"
            onAction={() => router.navigate('/discover')}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: { marginBottom: spacing.md },
  // A warm olive-washed panel so the greeting reads as a designed hero, not bare
  // text on paper. Soft tint keeps AA contrast for the serif greeting.
  hero: {
    marginBottom: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: surfaceTint(colors.accent, 0.07),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.sm,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.md,
  },
  subtitle: { marginTop: spacing.sm },
  zipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  empty: { flex: 1 },
});
