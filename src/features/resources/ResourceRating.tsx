import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, radii, spacing } from '@/theme';
import { tapSelection } from '@/lib/haptics';
import { useActivity } from '@/services/activity';
import { ratingsService, EMPTY_RATING, type RatingAggregate } from '@/services/ratings';
import { getDeviceId } from '@/services/sync/deviceId';
import type { Rating } from '@/types/activity';

/**
 * Real community rating for a resource: "N found this helpful" plus a thumbs
 * control. The count is the live aggregate of everyone's votes (0 until people
 * vote) — never simulated. The veteran's own vote is remembered on-device
 * (ActivityContext) so the button stays selected and the Home review prompt
 * knows it's been rated.
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
        // A rating read can fail on a bad network — a missing count is never
        // fatal, so leave it at zero rather than blocking the page.
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
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <View style={styles.votes}>
        <ThumbButton
          icon="thumbs-up"
          label="Mark helpful"
          selected={myVote === 'up'}
          onPress={() => vote('up')}
        />
        <ThumbButton
          icon="thumbs-down"
          label="Mark not helpful"
          selected={myVote === 'down'}
          onPress={() => vote('down')}
        />
      </View>
    </View>
  );
}

function ThumbButton({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: 'thumbs-up' | 'thumbs-down';
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        tapSelection();
        onPress();
      }}
      scaleTo={pressScale.control}
      style={[styles.thumb, selected && styles.thumbSelected]}
    >
      <Ionicons
        name={selected ? icon : (`${icon}-outline` as const)}
        size={16}
        color={selected ? colors.accent : colors.textSecondary}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // 8pt between two adjacent 44pt targets, the same gap the Home review card
  // keeps between its thumbs.
  votes: { flexDirection: 'row', gap: spacing.sm },
  // A real 44pt target. It was a 16pt glyph with 4pt of padding — 24pt, the
  // smallest control in the app, topped up with hitSlop nobody can see.
  thumb: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  // The same selected treatment as the Home review card's thumbs: one control,
  // one look.
  thumbSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
});
