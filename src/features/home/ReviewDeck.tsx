import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { durations, spacing, timings } from '@/theme';
import { promoteIn, throwOut } from '@/theme/motionPresets';
import type { EngagementEntry, Rating } from '@/types/activity';
import { ReviewPrompt } from './ReviewPrompt';

/**
 * The Home review deck: one unrated place at a time; renders nothing when empty.
 * A vote fills the thumb (in `ReviewPrompt`), then the card is thrown the way it
 * was voted and the next one enters.
 *
 * Declarative on purpose: the front slot is keyed by resource, so the next card
 * mounts fresh with `promoteIn`. Driving the throw with shared values and then
 * recording the vote cannot be frame-synchronised (UI frame vs React commit).
 *
 * The container must stay mounted while a card leaves, which is why the empty
 * case is handled here rather than gated in `home.tsx`.
 */

/** Where the next card enters from: a little low and dimmed, then settles. */
const PEEK_OFFSET = spacing.md;
const PEEK_OPACITY = 0.6;

/** Long enough to read the acknowledgement before the card leaves. */
const ACK_HOLD = timings.reviewAck;

/** Starting height (one-line card); the card's layout then sets the real one. */
const DECK_HEIGHT = 64;

type Vote = { id: string; choice: Rating };

export function ReviewDeck({
  reviews,
  onVote,
}: {
  /** Unrated engagements, newest first. Only the first is ever drawn. */
  reviews: EngagementEntry[];
  onVote: (entry: EngagementEntry, choice: Rating) => void;
}) {
  // Carries the id so it stops applying as soon as a different card is in front.
  const [vote, setVote] = useState<Vote | null>(null);
  const [deckHeight, setDeckHeight] = useState(DECK_HEIGHT);
  // Latches on the first vote, deliberately: the first card rides in on Home's
  // entrance, and every later card needs its own.
  const [promoting, setPromoting] = useState(false);
  // The last card is still leaving: keep the box's height so Android does not
  // clip its exit inside a zero-height parent.
  const [emptying, setEmptying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Shown but not yet recorded; committed on unmount if the user leaves mid-ack.
  const pending = useRef<{ entry: EngagementEntry; choice: Rating } | null>(null);
  const latestOnVote = useRef(onVote);

  useEffect(() => {
    latestOnVote.current = onVote;
  }, [onVote]);

  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      if (pending.current) latestOnVote.current(pending.current.entry, pending.current.choice);
    },
    [],
  );

  const [front] = reviews;
  const confirmed = front && vote?.id === front.resourceId ? vote.choice : null;

  // Holds the height open while `throwOut` runs. Keyed on `front`, so it covers
  // any route to an empty list.
  const hadCard = useRef(false);
  useEffect(() => {
    if (front) {
      hadCard.current = true;
      // Also cleared here: a card arriving mid-collapse cancels the timer.
      setEmptying(false);
      return;
    }
    if (!hadCard.current) return;
    hadCard.current = false;
    setEmptying(true);
    const collapse = setTimeout(() => setEmptying(false), durations.slow);
    return () => clearTimeout(collapse);
  }, [front]);

  const cast = (choice: Rating) => {
    // Guarded on the ref, not state: two presses in one batch would both see null.
    if (!front || pending.current) return;
    pending.current = { entry: front, choice };
    setVote({ id: front.resourceId, choice });
    setPromoting(true);

    // Armed before the haptic, so a synchronous throw there cannot strand the vote.
    timer.current = setTimeout(() => {
      timer.current = null;
      pending.current = null;
      setVote(null);
      onVote(front, choice);
    }, ACK_HOLD);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // No taptic engine is not worth surfacing.
    });
  };

  const measure = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    setDeckHeight(height);
  };

  return (
    // Fixed height while cards (absolutely positioned) overlap, and while the last
    // one leaves. `collapsable={false}` stops Android flattening this View away
    // mid-exit; a removed parent does not wait for its children's exits.
    <View collapsable={false} style={front || emptying ? { height: deckHeight } : null}>
      {front ? (
        <Animated.View
          key={front.resourceId}
          style={styles.slot}
          entering={promoting ? promoteIn(PEEK_OFFSET, PEEK_OPACITY) : undefined}
          exiting={throwOut(confirmed === 'down' ? -1 : 1)}
          pointerEvents={confirmed ? 'none' : 'auto'}
          onLayout={measure}
        >
          <ReviewPrompt engagement={front} confirmed={confirmed} onVote={cast} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', top: 0, left: 0, right: 0 },
});
