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
// an opportunity and reports which way the veteran voted. Recording the vote and
// clearing the card away are the deck's job (`ReviewDeck`), because the vote must
// not land until the card has finished leaving.
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
      {/* The identity mark sits *beside* the label, the way every other card in
          the app carries its category — never as a tile above a heading, which
          is a named slop signal. */}
      <View style={styles.header}>
        <CategoryMedallion icon={meta.icon} color={meta.color} size={44} style={styles.medallion} />
        <View style={styles.headerText}>
          <AppText variant="caption" color="textSecondary">
            {meta.label}
          </AppText>
          {/* `subtitle`, the register every card in this app uses for its own
              subject. It was briefly `heading` to outrank the section title
              below — which it cannot do at the same variant, and which cost 20pt
              of line width: at 20/26 in the column the medallion leaves, real
              names ("Michael E. DeBakey VA Medical Center") ran past two lines
              and the clamp ate the name of the place being asked about. The card
              carries its prominence with a surface and a medallion instead. */}
          <AppText variant="subtitle" numberOfLines={2}>
            How was {engagement.resourceName}?
          </AppText>
        </View>
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

      {/* One slot, two states. The acknowledgement *replaces* the link rather
          than joining it, because `ReviewDeck` sizes itself from a measured
          height that only ever grows — a card that got taller after a vote would
          shove the page down mid-acknowledgement. Both states hold `minHeight:
          44`, so the swap costs no height. The link is also dead weight at that
          moment: the card is already on its way out. */}
      {confirmed ? (
        <View style={styles.ackSlot}>
          {/* `accessibilityLiveRegion` is **Android only** (it is declared on
              `AccessibilityPropsAndroid` in React Native's own types), and
              `role="alert"` sets a trait on iOS rather than announcing. The
              thumb the veteran pressed keeps VoiceOver focus and is now
              `disabled`, so on iOS this line would never be read — the one
              moment the feature exists to communicate. `announceAck` below
              covers that half. */}
          <AppText variant="label" color="textSecondary" accessibilityLiveRegion="polite">
            {ackMessage(confirmed)}
          </AppText>
        </View>
      ) : (
        /* Hugs its content and sits left. It used to be a full-width 44pt row: a
           `Card` stretches its children, so an invisible navigate-away target ran
           the whole width of the card 16pt under "Not helpful" — a low miss on
           the thumb took you off the screen. */
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`View details for ${engagement.resourceName}`}
          onPress={openDetail}
          containerStyle={styles.detailSlot}
          style={styles.detailLink}
        >
          <AppText variant="label" color="textSecondary">
            View details
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </PressableScale>
      )}
    </Card>
  );
}

/**
 * A thumbs button that acknowledges the vote before the card leaves. Three
 * channels carry "you picked this", never colour alone: the glyph fills
 * (outline → solid), the button takes the olive selection wash, and it pops
 * once. Olive on both thumbs — `success` green means *verified* in this app and
 * would read as a claim about the opportunity rather than the veteran's answer.
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
            state, the one that has to be readable. Same reason `dangerText` and
            `warningText` exist. The icon stays on `accent`, where the 3:1
            non-text floor applies. */}
        <AppText variant="label" color={active ? 'accentPressed' : 'textPrimary'}>
          {label}
        </AppText>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // The card has a subject, so its rows are not all equidistant: the label and
  // the question are one block, then a real gap, then the answer.
  card: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  // The medallion's box top *is* its visual top, while a 12pt caption sits a few
  // points below its own line box. This is the optical nudge `xxs`-scale spacing
  // exists for — without it the mark rides high against the label it belongs to.
  medallion: { marginTop: spacing.xs },
  headerText: { flex: 1, gap: spacing.xxs },
  votes: { flexDirection: 'row', gap: spacing.sm },
  voteSlot: { flex: 1 },
  vote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // A real 44pt target. `paddingVertical: sm` around an 18pt glyph came to
    // about 34 — under the minimum every other control in the app meets.
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  voteActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  // The two thumbs are the answer; this is the way out of it. A real 44pt target
  // that hugs its label instead of spanning the card.
  detailSlot: { alignSelf: 'flex-start' },
  // Matches the link's 44pt so swapping one for the other costs no height. The
  // message is kept short enough to sit on one line at default type; two lines
  // (36pt) still fit under the floor, so the card only grows at accessibility
  // sizes — and `ReviewDeck`'s measurement only ever grows, so a long line would
  // reserve that height for every later card in the session.
  ackSlot: { minHeight: 44, justifyContent: 'center' },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: 44,
    paddingRight: spacing.sm,
  },
});
