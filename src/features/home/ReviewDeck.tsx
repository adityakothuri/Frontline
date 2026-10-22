import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Card } from '@/components';
import { durations, spacing, timings } from '@/theme';
import { promoteIn, throwOut } from '@/theme/motionPresets';
import type { EngagementEntry, Rating } from '@/types/activity';
import { ReviewPrompt } from './ReviewPrompt';

/**
 * The Home review deck: the place the veteran hasn't rated yet, with the
 * next one showing behind it — and, once there is nothing left to rate, nothing
 * at all.
 *
 * That last part used to be a resting note explaining that ratings would appear
 * here after visiting or calling somewhere. It was removed on 2026-08-05: on a
 * first launch it was a large grey box apologising for a feature the veteran had
 * not reached yet, sitting on a page that had little else on it. A section with
 * no content is better drawn as no section.
 *
 * A vote is two beats: the thumb fills and pops (inside `ReviewPrompt`), then the
 * card leaves the way it was voted and the one behind rises into its place.
 *
 * ## Why this is declarative
 *
 * The first version drove the throw with four Reanimated shared values and, when
 * the animation finished, reset them to identity *and then* recorded the vote, on
 * the theory that both would land on the same frame. They cannot. A
 * `sharedValue.set()` from the JS thread applies on the next **UI** frame, while
 * recording the vote goes through `ActivityProvider` — above the whole navigator
 * — and lands on a later **React** commit. In the gap, the card that had just
 * been thrown off the screen snapped back to dead centre at full opacity, still
 * showing the opportunity the veteran had already answered, while the card behind
 * dropped back to its peek. That was the jitter.
 *
 * There is nothing to synchronise here. The peek's resting state and the front
 * slot's resting state differ only by `PEEK_OFFSET` and `PEEK_OPACITY`, so the
 * incoming card simply *enters from* those values (`promoteIn`) and settles where
 * it belongs. Whichever frame React commits on, the handoff looks the same — and
 * Reduce Motion is the library's job again rather than a hand-rolled branch.
 *
 * ## Two invariants that are easy to break
 *
 * 1. **The peek must not be an `Animated.View`.** When the list shifts, the next
 *    card's key moves from the peek slot to the front slot. React only remounts
 *    it — which is what lets `promoteIn` run — because the two slots are
 *    *different component types*. Make them the same and React reuses the fiber,
 *    moves it, and the card hard-snaps into place with no entrance at all.
 * 2. **The container must stay mounted while a card leaves.** The exiting card is
 *    removed from a parent that survives. This is why the empty case is `null`
 *    *inside* this component rather than a `reviews.length` check in `home.tsx`:
 *    voting on the last card empties the list, and a caller-side gate would
 *    unmount this whole tree on that same commit — throwing the card away
 *    mid-throw instead of letting it finish leaving.
 */

/** How far below the front card the next one shows, and how dim it is drawn.
 *  `promoteIn` is handed these so the entrance starts exactly where the peek
 *  sits; if the two ever disagree the handoff visibly jumps. */
const PEEK_OFFSET = spacing.md;
const PEEK_OPACITY = 0.6;

/** Long enough to read the acknowledgement the card swaps in before it leaves.
 *  See `timings.reviewAck` for why this stopped being `durations.base`. */
const ACK_HOLD = timings.reviewAck;

/**
 * The deck's height, derived rather than measured-from-nothing.
 *
 * `ReviewPrompt` is fixed except for its question, which is clamped to two lines,
 * so the tallest card is knowable: card padding 32 + header 44 (two 22pt lines
 * beside a 36pt medallion) + gap 12 + votes 44. Seeding the real maximum means
 * the common case never corrects itself on screen; the measurement below is
 * only a safety net for Dynamic Type. It was 214 when the card carried a
 * category caption and a separate "View details" row; the name is the link now.
 */
const DECK_HEIGHT = 132;

type Vote = { id: string; choice: Rating };

export function ReviewDeck({
  reviews,
  onVote,
}: {
  /** Unrated engagements, newest first. Only the first two are ever drawn. */
  reviews: EngagementEntry[];
  onVote: (entry: EngagementEntry, choice: Rating) => void;
}) {
  // Carries the id, not just the choice, so it clears itself the moment a
  // different card is in front. Storing a bare `Rating` meant the deck had to
  // remember to null it at exactly the right time, which is one more thing to
  // get wrong on a frame boundary.
  const [vote, setVote] = useState<Vote | null>(null);
  const [deckHeight, setDeckHeight] = useState(DECK_HEIGHT);
  // Latches on the first vote and stays latched, which is deliberate rather than
  // an oversight. What it really gates is "Home's own entrance is no longer
  // carrying this slot", and that becomes true at the first vote and never goes
  // back: the first card rides in on the screen's entrance and must not also
  // promote, but every card after it — including one that arrives long after the
  // deck emptied, since a tab screen stays mounted — has nothing else to give it
  // an entrance, and would otherwise hard-pop into place.
  const [promoting, setPromoting] = useState(false);
  // Whether the *last* card is still on its way off the screen. The box has to
  // keep its height for that beat: `front` goes undefined on the same commit the
  // exit starts, and collapsing to zero immediately leaves an absolutely
  // positioned child animating outside a zero-height parent — which iOS draws
  // (overflow defaults to visible) and Android clips. That would silently eat
  // the one exit that matters most, the throw that completes the interaction.
  const [emptying, setEmptying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The answer that is on screen but not yet recorded. Kept in a ref so that
  // leaving Home mid-acknowledgement still commits it — the veteran tapped a
  // thumb and watched it fill, so the vote is theirs whether or not they stayed
  // the extra beat to watch the card go.
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

  const [front, peek] = reviews;
  const confirmed = front && vote?.id === front.resourceId ? vote.choice : null;

  // Holds the deck's height open for exactly as long as `throwOut` runs, then
  // lets it collapse. Keyed on `front` rather than on the vote, so it covers any
  // route to an empty list — including the list being emptied from elsewhere.
  const hadCard = useRef(false);
  useEffect(() => {
    if (front) {
      hadCard.current = true;
      // Cleared here as well as on the timer, for the case where a new
      // engagement lands *inside* the collapse window: the dep change cancels
      // the pending timeout, so without this the flag would stay true for the
      // rest of the deck's life. Invisible either way — `front` is truthy for
      // exactly that period, so the height applies regardless — but a flag that
      // silently stops meaning what it says is how the next bug gets written.
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
    // Guarded on the ref, not on `vote` state: two presses dispatched inside one
    // React batch would both read the same stale `null`, and both would arm a
    // timer. The ref is written synchronously, so the second press sees it.
    if (!front || pending.current) return;
    pending.current = { entry: front, choice };
    setVote({ id: front.resourceId, choice });
    setPromoting(true);

    // Armed before the haptic: if that ever threw synchronously the deck would
    // be left with a pending vote and no timer to commit it, and the cleanup
    // above would discard it.
    timer.current = setTimeout(() => {
      timer.current = null;
      pending.current = null;
      setVote(null);
      onVote(front, choice);
    }, ACK_HOLD);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // No taptic engine (simulator, older device, or the module not built
        // into this client) is not a failure worth surfacing.
      });
    }
  };

  const measure = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    setDeckHeight((current) => (height > current ? height : current));
  };

  return (
    // Fixed height while there are cards — they are absolutely positioned, so the
    // leaving one and the arriving one overlap without either pushing the page —
    // and for one `durations.slow` beat after the last one goes, so its throw has
    // a box to travel inside (see `emptying`). Then it collapses to nothing,
    // which is the point.
    // `collapsable={false}`: with no cards this View has a null style and now no
    // children either, which makes it a prime candidate for Android view
    // flattening — and it would collapse on exactly the commit where the *last*
    // card is playing its exit. Reanimated's docs are explicit that a removed
    // non-animated parent does not wait for its children's exiting animations.
    <View collapsable={false} style={front || emptying ? { height: deckHeight } : null}>
      {peek ? (
        // A bare shell, not a second `ReviewPrompt`. Only a sliver of the card
        // behind is ever visible, and rendering a whole interactive card to draw
        // it meant the lip disappeared entirely whenever the next resource's name
        // was shorter than the current one. Filling the deck guarantees it.
        // Decorative, so a screen reader never meets the same card twice.
        <View
          key={peek.resourceId}
          style={[styles.slot, styles.peek, { height: deckHeight }]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Card style={styles.peekCard} />
        </View>
      ) : null}

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
  // No `deck` entry: the height is conditional and applied inline at the call
  // site, and the `marginBottom` that used to live here is gone — the deck is
  // the last block on Home now, and the gap between page sections is Home's to
  // set rather than a component's to carry around.
  slot: { position: 'absolute', top: 0, left: 0, right: 0 },
  peek: { transform: [{ translateY: PEEK_OFFSET }], opacity: PEEK_OPACITY },
  peekCard: { flex: 1 },
});
