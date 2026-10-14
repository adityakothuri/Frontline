import { useMemo, useState } from 'react';
import { View, FlatList, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppText,
  ErrorState,
  RefreshFailedBanner,
  NavigatorDisclaimer,
  PrimaryButton,
  ScreenContainer,
  Skeleton,
} from '@/components';
import { colors, radii, spacing } from '@/theme';
import { fadeIn, fadeOut, riseIn, stepDelay } from '@/theme/motionPresets';
import { useStaggerGate } from '@/hooks/useStaggerGate';
import { useProfile } from '@/services/profile';
import { demoteDownvoted, splitLocalsAndReferrals } from '@/services/resources';
import { useActivity } from '@/services/activity';
import { stateFromZip } from '@/lib/zipState';
import { CrisisBanner } from '@/features/resources/CrisisBanner';
import { ResourceCard } from '@/features/resources/ResourceCard';
import { ReferralSection } from '@/features/resources/ReferralSection';
import { ResourceMap } from '@/features/resources/ResourceMap';
import { OfficialSourcesWidget } from '@/features/resources/OfficialSourcesWidget';
import { ViewToggle, type ResultsView } from '@/features/resources/ViewToggle';
import { resultsOf, useResourceSearch } from '@/features/resources/useResourceSearch';
import { defaultNeedForCategory, NEED_CATEGORY_META, type NeedCategory } from '@/types/need';

// Results for a category, as a list or a map of the same nearby resources. The
// local opportunity finder is the focus; an "Official online sources" widget sits
// below it (and in the empty state) as trusted backup.
export default function ResultsScreen() {
  const router = useRouter();
  const { profile, isHydrated: isProfileHydrated } = useProfile();
  const params = useLocalSearchParams<{ category: NeedCategory }>();

  const need = useMemo(
    () => defaultNeedForCategory(params.category, profile?.zip, profile?.preferredRadiusMiles),
    [params.category, profile?.zip, profile?.preferredRadiusMiles],
  );

  const { state, reload } = useResourceSearch(need, isProfileHydrated);
  const { getRating } = useActivity();
  const [view, setView] = useState<ResultsView>('list');
  // Only the first screenful of a fresh result set gets a staggered entrance.
  const staggered = useStaggerGate(state);
  // Selection is shared so the map preview and the list stay in sync across toggles.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Measured so the map can keep its own overlays clear of the floating toggle.
  const [toggleHeight, setToggleHeight] = useState(0);

  // Located results are strictly within whichever radius the search settled on
  // — the service widens past the veteran's setting when almost nothing is near
  // (see supabaseResourceService.search), so each card states its own distance.
  // Veteran resources with no pinpoint (SSVF, hotlines) go in a separate
  // "statewide" section, filtered to the veteran's state so it isn't
  // out-of-state noise.
  const veteranState = stateFromZip(profile?.zip);
  // `resultsOf` falls back to the last good results on a failed refresh, so the
  // screen keeps showing nearby help under a banner instead of an error card.
  //
  // A place the veteran marked "Not helpful" on Home sinks to the bottom of the
  // local list. It has to happen here rather than in the service: the ratings
  // live in `ActivityContext`, and `sortSearchResults` is called from
  // `supabaseResourceService`, where there is no React.
  //
  // `demoteDownvoted` is deliberately the **last** thing to touch a list that is
  // about to be rendered — the same rule Discover follows. Ordering it before a
  // regrouping step silently undoes it (see the `interleaveByCategory` note
  // there), and one uniform rule is easier to keep than a per-site judgement
  // about which downstream steps happen to preserve order.
  const { referrals, locals, referralsLead } = useMemo(() => {
    const split = splitLocalsAndReferrals(resultsOf(state), veteranState);
    return { ...split, locals: demoteDownvoted(split.locals, getRating) };
  }, [state, veteranState, getRating]);

  // The two views crossfade rather than snapping. This used to be a one-shot
  // `LayoutAnimation`, which silently did nothing on web; the entering/exiting
  // pair below works on every platform.
  const changeView = (next: ResultsView) => setView(next);

  // "See in map" on a card: flip to this screen's own map and focus the pin
  // (ResourceMap glides to selectedId). Keeps the veteran in the results context
  // rather than jumping to the global Map tab.
  const seeInMap = (id: string) => {
    setSelectedId(id);
    changeView('map');
  };

  const referralSection = (
    <ReferralSection
      referrals={referrals}
      leads={referralsLead}
      hasLocals={locals.length > 0}
      needCategoryFor={() => need.category}
    />
  );

  const categoryLabel = NEED_CATEGORY_META[need.category]?.label ?? 'Resources';
  // The Emergency path routes to real crisis lines before anything else — the
  // banner must survive every branch (list, map, empty), so it's decided once.
  const isEmergency = need.category === 'emergency';

  // Map view is the whole screen — edge-to-edge under the header, with the toggle
  // floating over it — so it reads as a real map, not a widget. Gated on
  // `locals.length`: referral-only results (national help lines) would map to zero
  // pins. Note that `locals` is split on "not a national referral", not on having
  // coordinates, so a local row with no geocode still lands here and shows up in
  // the map's off-map note instead of as a pin.
  if (locals.length > 0 && view === 'map') {
    return (
      <Animated.View entering={fadeIn()} exiting={fadeOut()} style={styles.mapScreen}>
        <Stack.Screen options={{ title: categoryLabel }} />
        {isEmergency ? (
          <View style={styles.mapCrisis}>
            <CrisisBanner />
          </View>
        ) : null}
        {/* No NavigatorDisclaimer here on purpose — a floating caption over the
            map would be noise; the list, empty, and detail views all carry it. */}
        <View style={styles.mapWrap}>
          <ResourceMap
            results={locals}
            needCategory={need.category}
            selectedId={selectedId}
            onSelect={setSelectedId}
            // The toggle floats over the map's top-right, and the map's off-map
            // note is centred at the top — wide enough, on a narrow screen, to run
            // straight under it. Reporting the toggle's real height pushes the note
            // clear of it.
            topInset={toggleHeight}
          />
          <View
            style={styles.toggleFloat}
            onLayout={(e) => setToggleHeight(e.nativeEvent.layout.height + spacing.sm * 2)}
          >
            <ViewToggle value={view} onChange={changeView} />
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: categoryLabel }} />
      {/* Crisis routing depends on nothing async — it must survive loading and
          error states too, not just results. */}
      {isEmergency ? <CrisisBanner style={styles.crisis} /> : null}
      {state.status === 'loading' ? (
        <ResultsSkeleton />
      ) : state.status === 'error' && referrals.length + locals.length === 0 ? (
        // Nothing to fall back on — the only case that earns the whole screen.
        <ErrorState error={state.error} onRetry={reload} />
      ) : referrals.length + locals.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyMsg}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={26} color={colors.textSecondary} />
            </View>
            <AppText variant="heading" style={styles.center}>
              No {categoryLabel.toLowerCase()} resources nearby
            </AppText>
            <AppText variant="body" color="textSecondary" style={styles.emptyText}>
              We couldn&apos;t find local {categoryLabel.toLowerCase()} resources
              {profile?.zip ? ` near ${profile.zip}` : ''}. Try updating your location — and the
              official sources below can still help.
            </AppText>
            <PrimaryButton
              label="Update location"
              variant="secondary"
              onPress={() => router.push('/profile')}
              style={styles.emptyBtn}
            />
          </View>
          <OfficialSourcesWidget category={need.category} />
          <NavigatorDisclaimer style={styles.disclaimer} />
        </ScrollView>
      ) : (
        <Animated.View entering={fadeIn()} style={styles.ready}>
          {state.status === 'error' ? (
            <RefreshFailedBanner error={state.error} onRetry={reload} />
          ) : null}
          <View style={styles.headerRow}>
            <AppText variant="body" color="textSecondary">
              {referrals.length + locals.length}{' '}
              {referrals.length + locals.length === 1 ? 'resource' : 'resources'}
            </AppText>
            {/* No toggle when nothing is mappable — a map of zero pins is a dead end. */}
            {locals.length > 0 ? <ViewToggle value={view} onChange={changeView} /> : null}
          </View>
          <FlatList
            style={styles.fill}
            data={locals}
            keyExtractor={(item) => item.resource.id}
            renderItem={({ item, index }) => (
              <Animated.View entering={staggered(index) ? riseIn(stepDelay(index)) : undefined}>
                <ResourceCard result={item} needCategory={need.category} onSeeInMap={seeInMap} />
              </Animated.View>
            )}
            ListHeaderComponent={referralsLead ? referralSection : null}
            ListFooterComponent={
              <>
                {referralsLead ? null : referralSection}
                <OfficialSourcesWidget category={need.category} />
                <NavigatorDisclaimer style={styles.disclaimer} />
              </>
            }
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}
    </ScreenContainer>
  );
}

// Card-shaped placeholders where the results will land, so the page doesn't
// jump from a centered spinner to a full list.
function ResultsSkeleton() {
  return (
    <View
      style={styles.skeletons}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Finding nearby resources…"
    >
      <Skeleton width={120} height={16} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton width="55%" height={18} />
          <Skeleton width="35%" />
          <Skeleton width="80%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ready: { flex: 1, gap: spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fill: { flex: 1 },
  list: { gap: spacing.md, paddingBottom: spacing.xl },
  emptyScroll: { paddingBottom: spacing.xl },
  emptyMsg: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  emptyText: { textAlign: 'center', maxWidth: 320 },
  emptyBtn: { marginTop: spacing.md, paddingHorizontal: spacing.xxl },
  mapScreen: { flex: 1, backgroundColor: colors.background },
  crisis: { marginBottom: spacing.lg },
  mapCrisis: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  // Keeps the floating toggle anchored to the map, not the screen, so the
  // crisis banner above can't sit under it.
  mapWrap: { flex: 1 },
  toggleFloat: { position: 'absolute', top: spacing.sm, right: spacing.md },
  disclaimer: { marginTop: spacing.lg },
  skeletons: { gap: spacing.md },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
