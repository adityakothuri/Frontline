import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, ScreenHeader } from '@/components';
import { useProfile } from '@/services/profile';
import { useActivity } from '@/services/activity';
import { ratingsService } from '@/services/ratings';
import { getDeviceId } from '@/services/sync/deviceId';
import { spacing } from '@/theme';
import { ReviewDeck } from '@/features/home/ReviewDeck';
import { HomeStartCard } from '@/features/home/HomeStartCard';
import { NearbyGlance } from '@/features/home/NearbyGlance';
import { DEFAULT_RADIUS_MILES } from '@/types/need';
import type { EngagementEntry, Rating } from '@/types/activity';

// The front door: the wordmark and date, Ask Frontline, a one-line question
// about the last place they tried, then the kinds of help with most places nearby.
export default function HomeScreen() {
  const router = useRouter();
  const { profile, isHydrated: isProfileHydrated } = useProfile();
  const { pendingReviews, isHydrated, rate } = useActivity();

  const dateline = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Records the vote on-device, then adds it to the shared community count.
  // The deck calls this once the card has finished leaving.
  const recordVote = useCallback(
    async (entry: EngagementEntry, choice: Rating) => {
      rate(entry.resourceId, choice);
      const deviceId = await getDeviceId();
      if (!deviceId) return;
      ratingsService.submitVote(entry.resourceId, deviceId, choice).catch(() => {
        // The local vote still counts; the shared total catches up on next open.
      });
    },
    [rate],
  );

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <ScreenHeader
        location={{ zip: profile?.zip, onPress: () => router.navigate('/profile') }}
        title="Frontline"
        subtitle={profile?.firstName ? `${profile.firstName} · ${dateline}` : dateline}
      />

      <View style={styles.section}>
        <HomeStartCard />
      </View>

      {/* Mounted even when empty, so the last card's exit isn't torn down with it. */}
      {isHydrated ? (
        // The gap below only exists while there is a card to rate.
        <View style={pendingReviews.length > 0 ? styles.section : undefined}>
          <ReviewDeck reviews={pendingReviews} onVote={recordVote} />
        </View>
      ) : null}

      {/* Data-gated: it draws nothing on a failure or an empty ZIP. */}
      <NearbyGlance
        zip={profile?.zip}
        radiusMiles={profile?.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES}
        enabled={isProfileHydrated}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  section: { gap: spacing.md, marginBottom: spacing.xl },
});
