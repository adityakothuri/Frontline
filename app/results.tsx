import { useEffect, useMemo, useState } from 'react';
import { View, FlatList, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  EmptyState,
  ErrorState,
  RefreshFailedBanner,
  NavigatorDisclaimer,
  ScreenContainer,
  Skeleton,
} from '@/components';
import { colors, radii, spacing } from '@/theme';
import { fadeIn, riseIn, stepDelay } from '@/theme/motionPresets';
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
import { officialSourcesFor } from '@/data/officialSources';
import { ViewToggle, type ResultsView } from '@/features/resources/ViewToggle';
import { resultsOf, useResourceSearch } from '@/features/resources/useResourceSearch';
import { defaultNeedForCategory, isNeedCategory, NEED_CATEGORY_META } from '@/types/need';

// Results for one category, as a list or a map of the same nearby places, with
// official online sources below as a trusted backup.
export default function ResultsScreen() {
  const router = useRouter();
  const { profile, isHydrated: isProfileHydrated } = useProfile();
  const params = useLocalSearchParams<{ category?: string }>();
  // A deep link can carry any string; an unknown category goes back to Discover.
  const category = isNeedCategory(params.category) ? params.category : null;
  useEffect(() => {
    if (category === null) router.replace('/discover');
  }, [category, router]);

  const need = useMemo(
    () =>
      defaultNeedForCategory(category ?? 'essentials', profile?.zip, profile?.preferredRadiusMiles),
    [category, profile?.zip, profile?.preferredRadiusMiles],
  );

  const { state, reload } = useResourceSearch(need, isProfileHydrated && category !== null);
  const { getRating } = useActivity();
  const [view, setView] = useState<ResultsView>('list');
  const staggered = useStaggerGate(state);
  // Shared so the map preview and the list stay in sync across toggles.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toggleHeight, setToggleHeight] = useState(0);

  // Veteran help with no pinpoint (SSVF, hotlines) goes in its own statewide
  // section, filtered to the veteran's state.
  const veteranState = stateFromZip(profile?.zip);
  // `resultsOf` keeps the last good list on a failed refresh. Places rated "Not
  // helpful" sink to the bottom; ratings live in React context, so this can't
  // happen in the service. `demoteDownvoted` must run last — any regrouping
  // after it would undo it.
  const { referrals, locals, referralsLead } = useMemo(() => {
    const split = splitLocalsAndReferrals(resultsOf(state), veteranState);
    return { ...split, locals: demoteDownvoted(split.locals, getRating) };
  }, [state, veteranState, getRating]);

  // "See in map" on a card flips to this screen's own map and focuses the pin,
  // keeping the veteran in this category rather than the Map tab.
  const seeInMap = (id: string) => {
    setSelectedId(id);
    setView('map');
  };

  const referralSection = (
    <ReferralSection
      referrals={referrals}
      leads={referralsLead}
      hasLocals={locals.length > 0}
      needCategoryFor={() => need.category}
    />
  );

  const categoryLabel = NEED_CATEGORY_META[need.category].label;
  const radiusMiles = need.location.radiusMiles;
  // Crisis lines come first on the Emergency path, in every branch below.
  const isEmergency = need.category === 'emergency';

  // The map takes the whole screen under the header, with the toggle floating
  // over it. Referral-only results would map to zero pins, so it needs locals;
  // a local row with no geocode is counted in the map's off-map note.
  if (locals.length > 0 && view === 'map') {
    return (
      // Not an `Animated.View`: a native map mounted inside an entering
      // animation can paint blank. `ResourceMap` owns its own reveal.
      <View style={styles.mapScreen}>
        <Stack.Screen options={{ title: categoryLabel }} />
        {isEmergency ? (
          <View style={styles.mapCrisis}>
            <CrisisBanner />
          </View>
        ) : null}
        <View style={styles.mapWrap}>
          <ResourceMap
            results={locals}
            needCategory={need.category}
            selectedId={selectedId}
            onSelect={setSelectedId}
            // Keeps the map's off-map note clear of the floating toggle.
            topInset={toggleHeight}
          />
          <View
            style={styles.toggleFloat}
            onLayout={(e) => setToggleHeight(e.nativeEvent.layout.height + spacing.sm * 2)}
          >
            <ViewToggle value={view} onChange={setView} />
          </View>
        </View>
      </View>
    );
  }

  if (category === null) return null;

  return (
    // Bottom only: the stack header already clears the status bar.
    <ScreenContainer edges={['bottom']}>
      <Stack.Screen options={{ title: categoryLabel }} />
      {isEmergency ? <CrisisBanner style={styles.crisis} /> : null}
      {state.status === 'loading' ? (
        <ResultsSkeleton />
      ) : state.status === 'error' && referrals.length + locals.length === 0 ? (
        <ErrorState error={state.error} onRetry={reload} />
      ) : referrals.length + locals.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyMsg}>
            <EmptyState
              title={`Nothing nearby for ${categoryLabel}`}
              message={`We looked within ${radiusMiles} miles${profile?.zip ? ` of ${profile.zip}` : ''} and didn’t find a local match. A wider radius or a nearby ZIP usually finds more${officialSourcesFor(need.category).length > 0 ? ' — and the official sources below can help right now.' : '.'}`}
              actionLabel="Change ZIP or radius"
              onAction={() => router.push({ pathname: '/profile', params: { edit: '1' } })}
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
            <AppText variant="data" color="textSecondary" style={styles.count}>
              {referrals.length + locals.length}{' '}
              {referrals.length + locals.length === 1 ? 'place' : 'places'}
              {profile?.zip ? ` near ${profile.zip}` : ''}
            </AppText>
            {/* No toggle when nothing is mappable. */}
            {locals.length > 0 ? <ViewToggle value={view} onChange={setView} /> : null}
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

// Ruled placeholder rows where the results will land, so the page doesn't jump
// from a spinner to a full list.
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
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={4} height={88} borderRadius={0} delay={i * 120} />
          <View style={styles.skeletonLines}>
            <Skeleton width="30%" height={12} delay={i * 120} />
            <Skeleton width="65%" height={20} delay={i * 120} />
            <Skeleton width="40%" height={12} delay={i * 120} />
            <Skeleton width="90%" delay={i * 120} />
          </View>
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
    gap: spacing.md,
  },
  count: { flexShrink: 1 },
  fill: { flex: 1 },
  list: { paddingBottom: spacing.xl },
  emptyScroll: { paddingBottom: spacing.xl },
  emptyMsg: { paddingVertical: spacing.xxl },
  mapScreen: { flex: 1, backgroundColor: colors.background },
  crisis: { marginBottom: spacing.lg },
  mapCrisis: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  // Keeps the floating toggle anchored to the map, not the screen, so the
  // crisis banner above can't sit under it.
  mapWrap: { flex: 1 },
  toggleFloat: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.md,
    borderRadius: radii.sm,
  },
  disclaimer: { marginTop: spacing.lg },
  skeletons: { gap: spacing.md },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  skeletonLines: { flex: 1, gap: spacing.sm },
});
