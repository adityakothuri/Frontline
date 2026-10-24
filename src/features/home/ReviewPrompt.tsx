import { useEffect } from 'react';
import { AccessibilityInfo, Platform, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Card, GlyphButton, PressableScale } from '@/components';
import { pressScale, spacing, swatchStyle } from '@/theme';
import { resourceToNeedCategory } from '@/services/resources';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { EngagementEntry, Rating } from '@/types/activity';

// "How was ___?" — one card in the Home review deck. It only reports the vote;
// `ReviewDeck` records it once the card has finished leaving.

/**
 * The acknowledgement; short enough to read within `timings.reviewAck`. The
 * downvote says "this one" because `demoteDownvoted` sinks only that place.
 */
const ackMessage = (choice: Rating) =>
  choice === 'down' ? "Thanks — we'll show this one lower." : 'Glad that one helped.';

export function ReviewPrompt({
  engagement,
  confirmed,
  onVote,
}: {
  engagement: EngagementEntry;
  /** The vote just cast, while the card is acknowledging it. */
  confirmed: Rating | null;
  onVote: (choice: Rating) => void;
}) {
  const router = useRouter();
  const meta = RESOURCE_CATEGORY_META[engagement.category];

  // iOS only: VoiceOver has no live regions. Android uses
  // `accessibilityLiveRegion` and would otherwise hear it twice.
  useEffect(() => {
    if (!confirmed || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(ackMessage(confirmed));
  }, [confirmed]);

  const openDetail = () =>
    router.push({
      pathname: '/resource/[id]',
      params: { id: engagement.resourceId, category: resourceToNeedCategory(engagement.category) },
    });

  return (
    // The acknowledgement replaces the question at the same height, so the
    // deck's measured height does not change.
    <Card variant="panel" style={styles.card}>
      <View style={swatchStyle(meta.color, 10)} />
      {confirmed ? (
        <View style={styles.slot}>
          {/* Android hears this live region; iOS gets the announcement above. */}
          <AppText variant="label" color="textSecondary" accessibilityLiveRegion="polite">
            {ackMessage(confirmed)}
          </AppText>
        </View>
      ) : (
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`View details for ${engagement.resourceName}`}
          onPress={openDetail}
          scaleTo={pressScale.subtle}
          containerStyle={styles.slotContainer}
          style={styles.slot}
        >
          <AppText variant="kicker" color="textSecondary">
            How was it?
          </AppText>
          <AppText variant="label" numberOfLines={2}>
            {engagement.resourceName}
          </AppText>
        </PressableScale>
      )}
      <GlyphButton
        name="check"
        label="Helpful"
        selected={confirmed === 'up'}
        disabled={confirmed === 'down'}
        onPress={() => onVote('up')}
      />
      <GlyphButton
        name="close"
        label="Not helpful"
        selected={confirmed === 'down'}
        disabled={confirmed === 'up'}
        onPress={() => onVote('down')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  slotContainer: { flex: 1 },
  slot: { flex: 1, minHeight: 44, justifyContent: 'center', gap: spacing.xxs },
});
