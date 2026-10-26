import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText, GlyphButton } from '@/components';
import { colors, spacing } from '@/theme';
import { useActivity } from '@/services/activity';
import { ratingsService, EMPTY_RATING, type RatingAggregate } from '@/services/ratings';
import { getDeviceId } from '@/services/sync/deviceId';
import type { Rating } from '@/types/activity';

/**
 * Community rating: "N found this helpful" plus a thumbs control. The count is
 * the live aggregate; the veteran's own vote is kept on-device (ActivityContext).
 */
export function ResourceRating({ resourceId }: { resourceId: string }) {
  const { getRating, rate } = useActivity();
  const myVote = getRating(resourceId);
  const [aggregate, setAggregate] = useState<RatingAggregate>(EMPTY_RATING);

  useEffect(() => {
    let active = true;
    ratingsService
      .getAggregate(resourceId)
      .then((a) => active && setAggregate(a))
      .catch(() => {
        // A missing count is not fatal; leave it at zero.
      });
    return () => {
      active = false;
    };
  }, [resourceId]);

  const vote = useCallback(
    async (choice: Rating) => {
      rate(resourceId, choice); // local: drives selected state + review prompt
      const deviceId = await getDeviceId();
      if (!deviceId) return; // no device id (offline stub) — local vote still recorded
      try {
        setAggregate(await ratingsService.submitVote(resourceId, deviceId, choice));
      } catch {
        // Keep the local vote; the shared count will catch up on the next open.
      }
    },
    [rate, resourceId],
  );

  const { helpful, notHelpful } = aggregate;
  const total = helpful + notHelpful;
  const label = total === 0 ? 'No ratings yet' : `${helpful} of ${total} found this helpful`;

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <AppText variant="kicker">Was this helpful?</AppText>
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
      </View>
      <GlyphButton
        name="check"
        label="Mark helpful"
        selected={myVote === 'up'}
        onPress={() => vote('up')}
      />
      <GlyphButton
        name="close"
        label="Mark not helpful"
        selected={myVote === 'down'}
        onPress={() => vote('down')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  copy: { flex: 1, gap: spacing.xxs },
});
