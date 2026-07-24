import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, EmptyState, LocationButton, ScreenContainer } from '@/components';
import { useProfile } from '@/services/profile';
import { useActivity } from '@/services/activity';
import { timeGreeting } from '@/lib/greeting';
import { dailyHomeMessage } from '@/lib/homeMessages';
import { colors, spacing } from '@/theme';
import { ReviewPrompt } from '@/features/home/ReviewPrompt';

// The front door: a warm, personal landing. Greeting + a message, then a prompt
// to rate the last opportunity you engaged with — or a nudge to go explore.
export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { pendingReview, isHydrated } = useActivity();

  const greeting = profile?.firstName
    ? `${timeGreeting()}, ${profile.firstName}`
    : timeGreeting();

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <LocationButton zip={profile?.zip} onPress={() => router.navigate('/profile')} />
      </View>
      <View style={styles.hero}>
        <AppText variant="display">{greeting}</AppText>
        <AppText variant="body" color="textSecondary" style={styles.subtitle}>
          {dailyHomeMessage()}
        </AppText>
        {profile?.zip ? (
          <View style={styles.zipRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <AppText variant="caption" color="textMuted">
              Showing help near {profile.zip}
            </AppText>
          </View>
        ) : null}
      </View>

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
  hero: { marginBottom: spacing.xl },
  subtitle: { marginTop: spacing.sm },
  zipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  empty: { flex: 1 },
});
