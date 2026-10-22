import { useEffect } from 'react';
import { AccessibilityInfo, Platform, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, CategoryMedallion, PressableScale } from '@/components';
import { colors, durations, pressScale, radii, spacing, springs } from '@/theme';
import { easings } from '@/theme/motionPresets';
import { resourceToNeedCategory } from '@/services/resources';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { EngagementEntry, Rating } from '@/types/activity';

// "How was ___?" — one card in the Home review deck. Purely the card: it renders
// a place and reports which way the veteran voted. Recording the vote and
// clearing the card away are the deck's job (`ReviewDeck`), because the vote must
// not land until the card has finished leaving.
//
// Two rows, 132pt: the question beside its medallion, then the two thumbs. It
// was 214 with a category caption and a separate "View details" row; on Home
// a transient question is worth less than a standing fact, and the extra chrome
// was most of what made the page feel crowded. The name is the link now. One
// row was measured and rejected: beside a medallion and two 44pt thumbs the
// text column is ~131pt, which clips real names on the card asking about them.
/**
 * What the card says back. Short on purpose: the deck holds the card for
 * `timings.reviewAck` and then throws it, so a sentence that cannot be finished
 * in that window is worse than a shorter one that can.
 *
 * The downvote line says "this one", not "places like this" — `demoteDownvoted`
 * sinks the single place that was rated and there is no category or provider
 * preference model behind it. The copy is written to describe exactly what the
 * code does.
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

  // The iOS half of the acknowledgement. VoiceOver has no live-region support,
  // so the message has to be pushed to it explicitly; Android gets it from
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
    <Card style={styles.card}>
      {/* The identity mark sits *beside* the question, the way every other card
          in the app carries its category — never as a tile above a heading. The
          medallion is 36, the detail hero's size, so the card and the page it
          opens share one mark. */}
      <View style={styles.header}>
        <CategoryMedallion icon={meta.icon} color={meta.color} size={36} />
        {/* One slot, two states. The question is the way into the place it asks
            about — a real 44pt target that hugs the text, with the muted chevron
            as its affordance. Once a thumb is pressed the acknowledgement takes
            the question's place: the thumbs stay where they are to fill and pop,
            and `ReviewDeck` sizes itself from a measured height that only ever
            grows, so the swap has to cost no height. Both states hold 44. */}
        {confirmed ? (
          <View style={styles.ackSlot}>
            {/* `accessibilityLiveRegion` is **Android only**; the iOS half is the
                announcement above, since the pressed thumb keeps VoiceOver focus. */}
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
            containerStyle={styles.questionSlot}
            style={styles.question}
          >
            <AppText variant="subtitle" numberOfLines={2} style={styles.questionText}>
              How was {engagement.resourceName}?
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </PressableScale>
        )}
      </View>

      <View style={styles.votes}>
        <VoteButton
          icon="thumbs-up"
          label="Helpful"
          active={confirmed === 'up'}
          dimmed={confirmed === 'down'}
          onPress={() => onVote('up')}
        />
        <VoteButton
          icon="thumbs-down"
          label="Not helpful"
          active={confirmed === 'down'}
          dimmed={confirmed === 'up'}
          onPress={() => onVote('down')}
        />
      </View>
    </Card>
  );
}

/**
 * A thumbs button that acknowledges the vote before the card leaves. Three
 * channels carry "you picked this", never colour alone: the glyph fills
 * (outline → solid), the button takes the olive selection wash, and it pops
 * once. Olive on both thumbs — `success` green means *verified* in this
 * app and would read as a claim about the place rather than the veteran's answer.
 */
function VoteButton({
  icon,
  label,
  active,
  dimmed,
  onPress,
}: {
  icon: 'thumbs-up' | 'thumbs-down';
  label: string;
  active: boolean;
  /** The other thumb was chosen — recede so the answer reads at a glance. */
  dimmed: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.set(
        withSequence(
          withTiming(1.14, { duration: durations.micro, easing: easings.out }),
          withSpring(1, springs.settle),
        ),
      );
    }
  }, [active, scale]);

  useEffect(() => {
    opacity.set(withTiming(dimmed ? 0.4 : 1, { duration: durations.fast, easing: easings.out }));
  }, [dimmed, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    opacity: opacity.get(),
  }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      scaleTo={pressScale.chip}
      disabled={active || dimmed}
      // On the Pressable, not the inner layer: this is what makes the two thumbs
      // split the row evenly.
      containerStyle={styles.voteSlot}
    >
      {/* The press spring lives on PressableScale; this layer carries the
          confirm pop and the dim, so the two never fight over one transform. */}
      <Animated.View style={[styles.vote, active && styles.voteActive, animatedStyle]}>
        <Ionicons
          name={active ? icon : (`${icon}-outline` as const)}
          size={18}
          color={active ? colors.accent : colors.textPrimary}
        />
        {/* accentPressed, not accent: at 13pt on the olive selection wash the
            brand accent measures 4.16:1, under AA — and this is the *selected*
            state, the one that has to be readable. */}
        <AppText variant="label" color={active ? 'accentPressed' : 'textPrimary'}>
          {label}
        </AppText>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Two rows, one gap: the question is the subject and the thumbs are the answer.
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  questionSlot: { flex: 1 },
  question: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  questionText: { flex: 1 },
  votes: { flexDirection: 'row', gap: spacing.sm },
  voteSlot: { flex: 1 },
  vote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // A real 44pt target, the minimum every other control in the app meets.
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  voteActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  // Matches the question link's 44pt so swapping one for the other costs no
  // height; the message is short enough for one line at default type.
  ackSlot: { flex: 1, minHeight: 44, justifyContent: 'center' },
});
