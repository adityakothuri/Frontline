import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { AppText, LocationButton, NavigatorDisclaimer, ScreenContainer } from '@/components';
import { useProfile } from '@/services/profile';
import { useActivity } from '@/services/activity';
import { ratingsService } from '@/services/ratings';
import { getDeviceId } from '@/services/sync/deviceId';
import { timeGreeting } from '@/lib/greeting';
import { durations, rise, spacing, stagger } from '@/theme';
import { fadeIn, riseIn, settleIn } from '@/theme/motionPresets';
import { ReviewDeck } from '@/features/home/ReviewDeck';
import { HomeStartCard } from '@/features/home/HomeStartCard';
import { NearbyGlance } from '@/features/home/NearbyGlance';
import { DEFAULT_RADIUS_MILES } from '@/types/need';
import type { EngagementEntry, Rating } from '@/types/activity';

// The front door: a warm, personal landing. The greeting is the page title — on
// paper, not in a panel — then the one way in (Ask Frontline), then what is
// actually near this veteran, then whatever they are being asked to do (rate
// the last place they tried).
//
// The 2×2 need grid that used to sit under the start card is gone — see
// `HomeStartCard` for why: four fixed tiles carried no information a veteran
// could act on. `NearbyGlance` is held to that same test. It is live, it names
// the categories that exist near their ZIP with real counts, and a tap lands on
// results. It also pre-warms the browse Discover and Map share, which is what
// makes those tabs paint instantly on first open.
//
// The order is deliberate. The card leads because it is the page's only primary
// action and a primary action does not go underneath anything. The glance
// follows because it is the card's answer in miniature. The deck follows that
// because a transient question is worth less than a standing fact, and it is
// kept small for the same reason. The Veterans Crisis Line used to close the
// page; it left on 2026-10-14 because four blocks and a crisis row read as
// congestion, and it is one tap away in Ask and on the Emergency results path.

export default function HomeScreen() {
  const router = useRouter();
  const { profile, isHydrated: isProfileHydrated } = useProfile();
  const { pendingReviews, isHydrated, rate } = useActivity();

  const greeting = profile?.firstName ? `${timeGreeting()}, ${profile.firstName}` : timeGreeting();

  // Records the thumbs vote on-device and, when a backend is configured, adds it
  // to the resource's real community count. Called by the deck once the card it
  // belongs to has finished leaving.
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

  // The front door assembles in beats — location, greeting, then the card — so it
  // settles in rather than snapping up all at once. The deck is outside that
  // ordering on purpose: it waits on `isHydrated`, so it arrives when the
  // activity store actually resolves rather than on a timer.
  return (
    // `flexGrow: 1` on the scroll content is what gives this page a floor. Home
    // is a handful of short blocks and, once there is nothing to rate, fewer
    // still — which left it top-stacked in the upper half of the viewport with
    // the rest trailing off into bare paper. Anchoring the disclaimer to the
    // bottom puts that space *between* two fixed points: a composition anchored
    // top and bottom reads as chosen, one that stops half way reads as one that
    // ran out.
    <ScreenContainer scroll contentStyle={styles.content}>
      <Animated.View entering={fadeIn()} style={styles.topBar}>
        <LocationButton zip={profile?.zip} onPress={() => router.navigate('/profile')} />
      </Animated.View>

      {/* Home is the one tab that does not use `ScreenHeader`: its title is the
          greeting at `display`, a step above the masthead's `title`, with the
          pill gap widened to match. It is also the one masthead with no line
          under its title. A rotating daily pleasantry used to sit there ("Let's
          see what's near you today."), and it was the only sentence on the page
          that did nothing — the ZIP is in the pill above, and the card below
          asks the page's one question. Removed 2026-10-14. */}
      <Animated.View entering={riseIn(stagger.step, rise.md)} style={styles.header}>
        {/* `display`, not `display`. The larger step is reserved for the
            onboarding hero (see `typography.ts`) and is set at ~1.17 leading for
            a single line; a greeting carrying a real first name wraps to two, and
            two lines of Fraunces at that leading read cramped. It also made a
            pleasantry the largest thing on a page whose entire point is one
            action. */}
        <AppText variant="display" accessibilityRole="header">
          {greeting}
        </AppText>
      </Animated.View>

      {/* The one spring on the page. `settleIn` is reserved for the one or two
          things that should feel physical rather than timed, and after the grid
          came out this is the only such thing on Home — it is the object the
          screen exists to offer, so it arrives with weight instead of fading up
          like a paragraph. */}
      <Animated.View entering={settleIn(rise.md).delay(stagger.step * 2)} style={styles.start}>
        <HomeStartCard />
      </Animated.View>

      {/* Data-gated, so it reveals on its own when the browse lands rather than
          taking a beat in the sequence above — the same reasoning as the deck.
          It owns its own entrance, its own section gap and its own silence: on a
          failure or an empty ZIP it draws nothing, and the page simply closes up. */}
      <NearbyGlance
        zip={profile?.zip}
        radiusMiles={profile?.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES}
        enabled={isProfileHydrated}
      />

      {/* Rendered whenever the store has hydrated, *not* only when there is
          something to rate — `ReviewDeck` draws nothing on an empty list, and it
          has to be the one deciding that. Gating it from out here would unmount
          the deck on the same commit the last card starts its exit, and the throw
          would be torn down with its parent half-way off the screen.

          Its entrance is a *reveal*, not a beat. `ActivityProvider` mounts after
          the launch gate, so `isHydrated` is false on Home's first paint and this
          block appears only once an AsyncStorage round trip lands — at
          `hydrationTime + delay`, which is not ordered against its siblings at
          all and on a slow read would finish past `durations.entrance`. So: no
          stagger delay, and `durations.reveal`, the token that exists for
          precisely this ("a screen-level reveal, once the data it was waiting on
          has landed"). `rise.md` because the deck is a whole panel — it was
          taking the 8pt content distance while being the largest block on the
          page.

          No trailing margin: the gap above it is the start card's to set, and the
          disclaimer below takes all the remaining space rather than a fixed one. */}
      {isHydrated ? (
        <Animated.View entering={riseIn(0, rise.md).duration(durations.reveal)}>
          <ReviewDeck reviews={pendingReviews} onVote={recordVote} />
        </Animated.View>
      ) : null}

      {/* Results and the resource detail page both carry this line, and the
          app's own front door — the screen most likely to be a veteran's first
          impression of what Frontline is — did not say anywhere that it is not
          the VA. Trust signals are meant to be visible, not buried one tap in.
          Bottom-anchored by `marginTop: 'auto'`, which is what turns the empty
          lower half into deliberate space between two fixed points. It fades
          rather than rises, and takes the entrance's last beat. */}
      <Animated.View entering={fadeIn(stagger.step * 3)} style={styles.foot}>
        <NavigatorDisclaimer />
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Spread into the ScrollView's `contentContainerStyle` by `ScreenContainer`,
  // so the content is free to grow to the viewport and the disclaimer below can
  // take the slack.
  content: { flexGrow: 1 },
  // `lg`, not `md`: 12pt was set when a panel sat under this pill and optically
  // absorbed it. Against a bare 32pt serif line it reads cramped.
  topBar: { marginBottom: spacing.lg },
  header: { marginBottom: spacing.xl },
  // The one real section boundary on the page, and it is Home's to set rather
  // than either component's — neither should carry the space to whatever a page
  // happens to put after it.
  start: { marginBottom: spacing.xl },
  // `auto` collects every spare point on the page, so the blank space sits
  // *between* the content and the foot rather than trailing off below everything.
  foot: { marginTop: 'auto', paddingTop: spacing.xxl },
});
