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
  invalidateResourceCache,
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

// On the "all" browse the results come back distance-sorted, so a dense category
// (healthcare) fills the top of the list. Round-robin across categories instead,
// so the list alternates and a veteran immediately sees the full variety the app
// offers. Each category keeps its own nearest-first order internally.
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

// Browse nearby help: a curated shell row over every place near the veteran (or
// one category), with an "Other" shell that opens the full category list.
export default function DiscoverScreen() {
  const router = useRouter();
  const { profile, isHydrated: isProfileHydrated } = useProfile();
  // Home's start card arrives with `shell=other`, so it lands on the full
  // category index rather than the `all` browse — it asks "What do you need help
  // with?", and this is the screen that answers it. Any other entry into the tab
  // starts where it always did.
  // Validated: a deep link or a stale route can carry any string, and an
  // unknown shell used to become `selected` — a list that looked like "All"
  // with no chip lit.
  const { shell: shellParam } = useLocalSearchParams<{ shell?: string }>();
  const shell = isShellId(shellParam) ? shellParam : undefined;
  const [selected, setSelected] = useState<ShellId>(shell ?? 'all');
  const [state, setState] = useState<ResourceSearchState>({ status: 'loading', stale: [] });
  const { getRating } = useActivity();

  // Bumped by the error state's Retry so the fetch effect re-runs on demand.
  // Clearing the cache first keeps "Try again" honest — see resourceCache.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => {
    invalidateResourceCache();
    setReloadToken((n) => n + 1);
  }, []);
  const stateStatus = state.status;

  const zip = profile?.zip;
  const radiusMiles = profile?.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES;
  // Holds only when there is nothing to show under it — the same rule the Map
  // tab uses. A refresh with stale rows keeps the list on screen; the masthead
  // used to count those rows while the shield covered them.
  const gate = useLoadingGate(
    state.status === 'loading' && resultsOf(state).length === 0,
    state.status === 'error',
  );
  // Only the first screenful of a shell gets a staggered entrance; past that,
  // and on every row FlatList recycles as you scroll, rows mount static.
  const staggered = useStaggerGate(selected);

  // Drop the fallback when the shell changes: last time's food pantries are not
  // a stale view of housing, they're the wrong answer. Runs before the fetch
  // effect below, which then carries an empty `stale` forward.
  useEffect(() => {
    setState({ status: 'loading', stale: [] });
  }, [selected]);

  // Coming back to a failed tab retries for the veteran. See the hook for why
  // this is not a `useFocusEffect` — the previous version looped.
  useRetryOnReturn(stateStatus === 'error', reload);

  // The tab stays mounted, so `shell` is applied on focus and then cleared —
  // otherwise arriving from Home a second time with the same value would look
  // like an unchanged prop and select nothing.
  useFocusEffect(
    useCallback(() => {
      if (!shell) return;
      setSelected(shell);
      router.setParams({ shell: '' });
    }, [shell, router]),
  );

  useEffect(() => {
    if (selected === 'other') return;
    // Wait for the profile. Before it hydrates `zip` is undefined, and a browse
    // with no origin returns referrals only — so firing now would paint a nearly
    // empty list and then refetch the moment the ZIP lands. Staying in `loading`
    // reads as the one wait it actually is.
    if (!isProfileHydrated) return;
    // `active` guards against out-of-order resolution: flipping between shells
    // faster than the network must not let an older response land last.
    let active = true;
    setState((prev) => ({ status: 'loading', stale: resultsOf(prev) }));
    resourceService
      .listResources(shellCategory(selected), zip, radiusMiles)
      .then((results) => {
        if (active) setState({ status: 'ready', results });
      })
      .catch((error) => {
        reportDataError('Discover', error);
        // Carry the results on screen forward, so a failed refresh degrades to a
        // banner rather than wiping a working list.
        if (active) setState((prev) => ({ status: 'error', error, stale: resultsOf(prev) }));
      });
    return () => {
      active = false;
    };
  }, [selected, zip, radiusMiles, reloadToken, isProfileHydrated]);

  // The multi-category "all" browse alternates categories; a single category
  // keeps its natural nearest-first order, with statewide/national veteran help
  // (no location) pulled into its own strip — above the list only when there's
  // little nearby — and filtered to the veteran's state so SSVF and the like
  // aren't out-of-state noise.
  const veteranState = stateFromZip(profile?.zip);
  const { referrals, displayResults, referralsLead } = useMemo(() => {
    // On a failed refresh this is the last good list, so the screen keeps
    // showing help while the banner explains the refresh didn't take.
    const source = resultsOf(state);
    if (source.length === 0) {
      return { referrals: [], displayResults: [], referralsLead: false };
    }
    // Places the veteran marked "Not helpful" on Home sink to the bottom, which
    // is what makes the review card's "we'll show this one lower" true here as
    // well as on Results. Ratings live in `ActivityContext`, so this cannot
    // happen in the service layer.
    //
    // It runs **last**, on the finished list, and that ordering is load-bearing:
    // `interleaveByCategory` re-buckets by category and round-robins, so
    // demoting beforehand only sank a row to the end of *its own bucket* and the
    // round-robin pulled it straight back up by bucket index. For a category
    // with one nearby result — routine outside a metro — a downvoted place moved
    // down a single row, which reads as broken rather than as narrow.
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
    if (gate.holding || (state.status === 'loading' && shown === 0)) return 'Finding help near you…';
    if (shown === 0) return 'Places that can help, near you.';
    const where = zip ? ` near ${zip}` : ' near you';
    return `${shown} ${shown === 1 ? 'place' : 'places'} that can help${where}.`;
  }, [selected, state.status, shown, zip, gate.holding]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* The masthead every tab wears. The subtitle is live: it says how many
          places are actually here instead of restating the tab's name. */}
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
          // "Other" is the full category index — every need category, including
          // the four with their own shell above. A veteran who doesn't find what
          // they want on the shell row should see the whole list here, not a
          // remainder that depends on which shells happen to be curated.
          <FlatList
            data={NEED_CATEGORIES}
            keyExtractor={(category) => category}
            renderItem={({ item, index }) => (
              <Animated.View entering={staggered(index) ? riseIn(stepDelay(index)) : undefined}>
                <NeedCategoryCard category={item} onPress={() => openCategory(item)} />
              </Animated.View>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        ) : gate.holding ? (
          gate.showShield ? (
            <Loading label="Finding help near you…" done={gate.done} onFinish={gate.finish} />
          ) : null
        ) : state.status === 'error' && displayResults.length === 0 && referrals.length === 0 ? (
          // Nothing to fall back on — this is the one case worth the whole screen.
          <ErrorState error={state.error} onRetry={reload} />
        ) : displayResults.length === 0 && referrals.length === 0 ? (
          // Almost always "nothing within your radius", not "we have nothing" —
          // so it offers the two things that actually change the answer.
          <EmptyState
            icon="search-outline"
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
              // Keyed on the shell so switching filters remounts the list: the
              // rows earn a fresh entrance, and the scroll position resets, which
              // is what you want when the contents change entirely.
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
  // `sm` under the title block, not the header's default `xl`: the chip row
  // directly below is part of the same reading unit.
  masthead: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, marginBottom: spacing.sm },
  content: { flex: 1 },
  banner: { paddingHorizontal: spacing.xl },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: 0,
    paddingBottom: spacing.xl,
  },
});
