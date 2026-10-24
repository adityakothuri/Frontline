import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  EmptyState,
  ErrorState,
  Loading,
  useLoadingGate,
  RefreshFailedBanner,
  ScreenHeader,
} from '@/components';
import { colors, spacing } from '@/theme';
import { riseIn, stepDelay } from '@/theme/motionPresets';
import { useStaggerGate } from '@/hooks/useStaggerGate';
import { useRetryOnReturn } from '@/hooks/useRetryOnReturn';
import {
  demoteDownvoted,
  resourceService,
  resourceToNeedCategory,
  splitLocalsAndReferrals,
  type ResourceSearchResult,
} from '@/services/resources';
import { useActivity } from '@/services/activity';
import { stateFromZip } from '@/lib/zipState';
import { reportDataError } from '@/services/monitoring';
import { useProfile } from '@/services/profile';
import { ResourceCard } from '@/features/resources/ResourceCard';
import { NeedCategoryCard } from '@/features/needs/NeedCategoryCard';
import {
  CategoryShells,
  isShellId,
  shellCategory,
  type ShellId,
} from '@/features/discover/CategoryShells';
import { ReferralSection } from '@/features/resources/ReferralSection';
import { resultsOf, type ResourceSearchState } from '@/features/resources/useResourceSearch';
import { NEED_CATEGORIES, DEFAULT_RADIUS_MILES, type NeedCategory } from '@/types/need';

// The "all" browse arrives distance-sorted, so a dense category (healthcare)
// would fill the top. Round-robin across categories instead; each keeps its own
// nearest-first order.
function interleaveByCategory(results: ResourceSearchResult[]): ResourceSearchResult[] {
  const buckets = new Map<string, ResourceSearchResult[]>();
  for (const r of results) {
    const arr = buckets.get(r.resource.category);
    if (arr) arr.push(r);
    else buckets.set(r.resource.category, [r]);
  }
  const groups = [...buckets.values()];
  const out: ResourceSearchResult[] = [];
  for (let i = 0; ; i++) {
    let added = false;
    for (const group of groups) {
      if (i < group.length) {
        out.push(group[i]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

// Browse nearby help: a shell row over every place near the veteran (or one
// category), with "Other" opening the full category index.
export default function DiscoverScreen() {
  const router = useRouter();
  const { profile, isHydrated: isProfileHydrated } = useProfile();
  // Home can open this tab on a given shell (`shell=other` lands on the full
  // category index). Validated, since a deep link can carry any string.
  const { shell: shellParam } = useLocalSearchParams<{ shell?: string }>();
  const shell = isShellId(shellParam) ? shellParam : undefined;
  const [selected, setSelected] = useState<ShellId>(shell ?? 'all');
  const [state, setState] = useState<ResourceSearchState>({ status: 'loading', stale: [] });
  const { getRating } = useActivity();

  // Bumped by the error state's Retry so the fetch effect re-runs on demand.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);
  const stateStatus = state.status;

  const zip = profile?.zip;
  const radiusMiles = profile?.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES;
  // Holds only when there is nothing to show; a refresh keeps stale rows up.
  const gate = useLoadingGate(state.status === 'loading' && resultsOf(state).length === 0);
  // Only the first screenful of a shell gets a staggered entrance.
  const staggered = useStaggerGate(selected);

  // A new shell drops the stale fallback: last shell's rows are the wrong answer,
  // not an old one. Runs before the fetch effect below.
  useEffect(() => {
    setState({ status: 'loading', stale: [] });
  }, [selected]);

  // Coming back to a failed tab retries.
  useRetryOnReturn(stateStatus === 'error', reload);

  // The tab stays mounted, so `shell` is applied on focus and then cleared;
  // otherwise a second arrival with the same value would select nothing.
  useFocusEffect(
    useCallback(() => {
      if (!shell) return;
      setSelected(shell);
      router.setParams({ shell: '' });
    }, [shell, router]),
  );

  useEffect(() => {
    if (selected === 'other') return;
    // Wait for the profile: without a ZIP the browse returns referrals only.
    if (!isProfileHydrated) return;
    // Guards against an older response landing after a newer one.
    let active = true;
    setState((prev) => ({ status: 'loading', stale: resultsOf(prev) }));
    resourceService
      .listResources(shellCategory(selected), zip, radiusMiles)
      .then((results) => {
        if (active) setState({ status: 'ready', results });
      })
      .catch((error) => {
        reportDataError('Discover', error);
        // A failed refresh degrades to a banner over the last good list.
        if (active) setState((prev) => ({ status: 'error', error, stale: resultsOf(prev) }));
      });
    return () => {
      active = false;
    };
  }, [selected, zip, radiusMiles, reloadToken, isProfileHydrated]);

  // "All" alternates categories. A single category stays nearest-first, with
  // statewide veteran help (no location) in its own strip, filtered to the
  // veteran's state and placed above the list only when little is nearby.
  const veteranState = stateFromZip(profile?.zip);
  const { referrals, displayResults, referralsLead } = useMemo(() => {
    const source = resultsOf(state);
    if (source.length === 0) {
      return { referrals: [], displayResults: [], referralsLead: false };
    }
    // Places rated "Not helpful" sink to the bottom. This must run last:
    // `interleaveByCategory` re-buckets, so demoting earlier would only sink a
    // row within its own category.
    if (shellCategory(selected) === undefined) {
      return {
        referrals: [],
        displayResults: demoteDownvoted(interleaveByCategory(source), getRating),
        referralsLead: false,
      };
    }
    const {
      locals,
      referrals: stateReferrals,
      referralsLead: lead,
    } = splitLocalsAndReferrals(source, veteranState);
    return {
      referrals: stateReferrals,
      displayResults: demoteDownvoted(locals, getRating),
      referralsLead: lead,
    };
  }, [state, selected, veteranState, getRating]);

  const referralSection = (
    <ReferralSection
      referrals={referrals}
      leads={referralsLead}
      hasLocals={displayResults.length > 0}
      needCategoryFor={(item) =>
        shellCategory(selected) ?? resourceToNeedCategory(item.resource.category)
      }
    />
  );

  const openCategory = (category: NeedCategory) =>
    router.push({ pathname: '/results', params: { category } });

  const shown = displayResults.length + referrals.length;
  const subtitle = useMemo(() => {
    if (selected === 'other') return 'Every kind of help Frontline can find for you.';
    if (gate.holding || (state.status === 'loading' && shown === 0))
      return 'Finding help near you…';
    if (shown === 0) return 'Places that can help, near you.';
    const where = zip ? ` near ${zip}` : ' near you';
    return `${shown} ${shown === 1 ? 'place' : 'places'} that can help${where}.`;
  }, [selected, state.status, shown, zip, gate.holding]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        style={styles.masthead}
        location={{ zip: profile?.zip, onPress: () => router.navigate('/profile') }}
        title="Find help nearby"
        subtitle={subtitle}
        subtitleKey={subtitle}
      />

      <CategoryShells selected={selected} onSelect={setSelected} />

      <View style={styles.content}>
        {selected === 'other' ? (
          // The full category index, including the categories with their own shell.
          <FlatList
            data={NEED_CATEGORIES}
            keyExtractor={(category) => category}
            renderItem={({ item, index }) => (
              <Animated.View entering={staggered(index) ? riseIn(stepDelay(index)) : undefined}>
                <NeedCategoryCard category={item} onPress={() => openCategory(item)} />
              </Animated.View>
            )}
            contentContainerStyle={[styles.list, styles.index]}
            showsVerticalScrollIndicator={false}
          />
        ) : gate.holding ? (
          gate.showShield ? (
            <Loading label="Finding help near you…" />
          ) : null
        ) : state.status === 'error' && displayResults.length === 0 && referrals.length === 0 ? (
          <ErrorState error={state.error} onRetry={reload} />
        ) : displayResults.length === 0 && referrals.length === 0 ? (
          // Almost always "nothing within your radius", so offer what changes that.
          <EmptyState
            title={
              profile?.zip
                ? `Nothing nearby for this near ${profile.zip}`
                : 'Nothing nearby for this yet'
            }
            message={`We looked within ${radiusMiles} miles. A wider search radius or a nearby ZIP usually finds more.`}
            actionLabel="Change ZIP or radius"
            onAction={() => router.push({ pathname: '/profile', params: { edit: '1' } })}
          />
        ) : (
          <>
            {state.status === 'error' ? (
              <View style={styles.banner}>
                <RefreshFailedBanner error={state.error} onRetry={reload} />
              </View>
            ) : null}
            <FlatList
              // Keyed on the shell: a new filter remounts the list and resets scroll.
              key={selected}
              data={displayResults}
              keyExtractor={(item) => item.resource.id}
              renderItem={({ item, index }) => (
                <Animated.View entering={staggered(index) ? riseIn(stepDelay(index)) : undefined}>
                  <ResourceCard
                    result={item}
                    needCategory={
                      shellCategory(selected) ?? resourceToNeedCategory(item.resource.category)
                    }
                  />
                </Animated.View>
              )}
              ListHeaderComponent={referralsLead ? referralSection : null}
              ListFooterComponent={referralsLead ? null : referralSection}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  // Tight under the title: the shell row below belongs to the same unit.
  masthead: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, marginBottom: spacing.sm },
  content: { flex: 1 },
  banner: { paddingHorizontal: spacing.xl },
  // Rows carry their own hairlines; a gap would break the ruling.
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  index: { paddingTop: spacing.sm },
});
