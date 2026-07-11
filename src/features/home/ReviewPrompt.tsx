import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card } from '@/components';
import { colors, radii, spacing } from '@/theme';
import { simulatedRating } from '@/lib/ratings';
import { useActivity } from '@/services/activity';
import { resourceToNeedCategory } from '@/services/resources';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { EngagementEntry } from '@/types/activity';

// "How was ___?" — surfaces the veteran's most recent unrated opportunity so they
// can leave a quick thumbs vote. The community rating shown is SIMULATED (demo)
// and their own vote is kept as a separate fact, never blended into it.
export function ReviewPrompt({ engagement }: { engagement: EngagementEntry }) {
  const router = useRouter();
  const { rate } = useActivity();
  const meta = RESOURCE_CATEGORY_META[engagement.category];
  const rating = simulatedRating(engagement.resourceId);

  const openDetail = () =>
    router.push({
      pathname: '/resource/[id]',
      params: { id: engagement.resourceId, category: resourceToNeedCategory(engagement.category) },
    });

  return (
    <Card style={styles.card}>
      <View style={styles.categoryChip}>
        <Ionicons name={meta.icon} size={14} color={meta.color} />
        <AppText variant="caption" color="textSecondary">
          {meta.label}
        </AppText>
      </View>

      <AppText variant="subtitle">How was {engagement.resourceName}?</AppText>

      <AppText variant="caption" color="textMuted">
        ★ {rating.average.toFixed(1)} · {rating.count} ratings · simulated (demo)
      </AppText>

      <View style={styles.votes}>
        <VoteButton icon="thumbs-up-outline" label="Helpful" onPress={() => rate(engagement.resourceId, 'up')} />
        <VoteButton icon="thumbs-down-outline" label="Not helpful" onPress={() => rate(engagement.resourceId, 'down')} />
      </View>

      <Pressable accessibilityRole="link" onPress={openDetail} hitSlop={6}>
        <AppText variant="label" color="textSecondary">
          View details ›
        </AppText>
      </Pressable>
    </Card>
  );
}

function VoteButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.vote, pressed && styles.votePressed]}
    >
      <Ionicons name={icon} size={18} color={colors.textPrimary} />
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  votes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  vote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  votePressed: { opacity: 0.7 },
});
