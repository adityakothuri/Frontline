import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { tapSelection } from '@/lib/haptics';
import { useRetryOnReturn } from '@/hooks/useRetryOnReturn';
import { resourceService } from '@/services/resources';
import { useProfile } from '@/services/profile';
import { reportDataError } from '@/services/monitoring';
import { ResourceMap } from '@/features/resources/ResourceMap';
import { MapCategoryFilter } from '@/features/resources/MapCategoryFilter';
import { resultsOf, type ResourceSearchState } from '@/features/resources/useResourceSearch';
import { RESOURCE_CATEGORIES, type ResourceCategory } from '@/types/resource';
import { DEFAULT_RADIUS_MILES } from '@/types/need';

// The Map tab: every located place near the veteran as a category pin. The
// masthead and category filter sit in a band above the map rather than floating
// over it. The tab lists nothing; its empty states route to Discover.
export default function MapScreen() {
  const router = useRouter();
  const { profile, isHydrated: isProfileHydrated } = useProfile();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [state, setState] = useState<ResourceSearchState>({ status: 'loading', stale: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Categories switched off. Tracked as hidden, not shown, so a category that
  // first appears after a ZIP change arrives visible.
  const [hidden, setHidden] = useState<Set<ResourceCategory>>(() => new Set());

  // Bumped to tell `ResourceMap` to re-frame its camera on the current pins.
  const [fitToken, setFitToken] = useState(0);

  // "See in map" from elsewhere arrives as `?focus=id`. It's applied once the
  // results contain that id, then cleared, so a later refetch can't reopen a
  // closed preview and the same id can arrive again (this tab never unmounts).
  useEffect(() => {
    if (typeof focus !== 'string' || focus.length === 0) return;
    const target = resultsOf(state).find((r) => r.resource.id === focus);
    if (!target) return;
    router.setParams({ focus: undefined });
    // A focus in a switched-off category turns that category back on.
    setHidden((prev) => {
      if (!prev.has(target.resource.category)) return prev;
      const next = new Set(prev);
      next.delete(target.resource.category);
      return next;
    });
    setSelectedId(focus);
  }, [focus, state, router]);

  // Bumped by the error state's Retry so the fetch effect re-runs on demand.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);
  const stateStatus = state.status;

  // Coming back to a failed tab retries.
  useRetryOnReturn(stateStatus === 'error', reload);

  const zip = profile?.zip;
  const radiusMiles = profile?.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES;

  // Fresh results, or the last good set after a failed refresh. The filter, map
  // and count all read this so they agree.
  const results = resultsOf(state);

  // Only a wait with no pins shows the shield; tearing down a live `MapView` on
  // every refresh would blank it and reset the camera.
  const gate = useLoadingGate(state.status === 'loading' && results.length === 0);

  useEffect(() => {
    // Wait for the profile, or the first query runs without a ZIP.
    if (!isProfileHydrated) return;
    // Guards against an older response landing after a newer one.
    let active = true;
    setState((prev) => ({ status: 'loading', stale: resultsOf(prev) }));
    resourceService
      .listResources(undefined, zip, radiusMiles)
      .then((results) => {
        if (active) setState({ status: 'ready', results });
      })
      .catch((error) => {
        reportDataError('Map', error);
        if (active) setState((prev) => ({ status: 'error', error, stale: resultsOf(prev) }));
      });
    return () => {
      active = false;
    };
  }, [zip, radiusMiles, reloadToken, isProfileHydrated]);

  // Located places per category, over the unfiltered results so a chip's count
  // never moves as chips toggle. Canonical category order, so the row is stable.
  const counts = useMemo(() => {
    const byCategory = new Map<ResourceCategory, number>();
    for (const { resource } of results) {
      if (resource.latitude === null || resource.longitude === null) continue;
      byCategory.set(resource.category, (byCategory.get(resource.category) ?? 0) + 1);
    }
    return RESOURCE_CATEGORIES.filter((c) => byCategory.has(c)).map((category) => ({
      category,
      count: byCategory.get(category) as number,
    }));
  }, [results]);

  // `hidden` persists across ZIPs, so downstream reads only the hidden
  // categories actually present here.
  const hiddenPresent = useMemo(() => {
    const present = new Set(counts.map((c) => c.category));
    return new Set([...hidden].filter((c) => present.has(c)));
  }, [counts, hidden]);

  const visibleResults = useMemo(
    () =>
      hiddenPresent.size === 0
        ? results
        : results.filter((r) => !hiddenPresent.has(r.resource.category)),
    [results, hiddenPresent],
  );

  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const pinned = counts.reduce(
    (sum, item) => (hiddenPresent.has(item.category) ? sum : sum + item.count),
    0,
  );
  const filtering = pinned < total;
  const nothingShowing = counts.length > 0 && pinned === 0;
  // One category isn't a filter, unless it's switched off: then its chip is the
  // only way to bring the pins back.
  const showFilter = counts.length > 1 || hiddenPresent.size > 0;

  const toggle = useCallback(
    (category: ResourceCategory) => {
      tapSelection();
      setHidden((prev) => {
        const next = new Set(prev);
        if (!next.delete(category)) next.add(category);
        return next;
      });
      // A pin that just left the map must not keep its card open.
      setSelectedId((current) => {
        const openCategory = results.find((r) => r.resource.id === current)?.resource.category;
        return openCategory === category ? null : current;
      });
    },
    [results],
  );
  const showAll = useCallback(() => {
    tapSelection();
    setHidden(new Set());
  }, []);

  // A ready query that found nothing: a rural ZIP, a typo, too small a radius.
  const nothingNearby = !gate.holding && state.status === 'ready' && results.length === 0;

  const subtitle = useMemo(() => {
    if (state.status === 'loading' && total === 0) return 'Finding resources near you…';
    if (total === 0) return 'Nothing pinned here yet.';
    if (filtering) {
      return `Showing ${pinned} of ${total} nearby ${total === 1 ? 'place' : 'places'}.`;
    }
    const where = zip ? ` near ${zip}` : '';
    return `${total} ${total === 1 ? 'place' : 'places'}${where}, pinned by category.`;
  }, [state.status, total, filtering, pinned, zip]);

  // Help exists but none of it has an address; Discover can list it.
  const nothingMappable =
    !gate.holding &&
    state.status === 'ready' &&
    results.length > 0 &&
    !results.some((r) => r.resource.latitude !== null && r.resource.longitude !== null);

  // Re-frame the camera when the ZIP changes, not only when pins do.
  const framedZipRef = useRef(zip);
  useEffect(() => {
    if (framedZipRef.current === zip) return;
    framedZipRef.current = zip;
    setFitToken((n) => n + 1);
  }, [zip]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        {/* The keyed subtitle fades in a new count, so a chip tap visibly lands. */}
        <ScreenHeader
          style={styles.masthead}
          location={{ zip, onPress: () => router.navigate('/profile') }}
          title="On the map"
          subtitle={subtitle}
          subtitleKey={subtitle}
        />

        {showFilter ? (
          <MapCategoryFilter
            counts={counts}
            hidden={hiddenPresent}
            onToggle={toggle}
            onShowAll={showAll}
          />
        ) : null}

        {state.status === 'error' && results.length > 0 ? (
          <View style={styles.banner}>
            <RefreshFailedBanner error={state.error} onRetry={reload} />
          </View>
        ) : null}
      </View>

      <View style={styles.mapArea}>
        {gate.holding ? (
          gate.showShield ? (
            <View style={styles.overlayContent}>
              <Loading label="Loading the map…" />
            </View>
          ) : null
        ) : nothingShowing ? (
          <View style={styles.overlayContent}>
            {/* No action: the "Show all" chip above is the way back. */}
            <EmptyState
              title="No categories showing"
              message="Every category is switched off, so there's nothing to pin. Tap “Show all” above to bring the pins back."
            />
          </View>
        ) : nothingMappable ? (
          <View style={styles.overlayContent}>
            <EmptyState
              title="Phone & online only"
              message={`Nothing near ${zip ?? 'you'} has a street address to map — these ${results.length === 1 ? 'resource is' : 'resources are'} reached by phone or online.`}
              actionLabel="Browse them in Discover"
              onAction={() => router.navigate('/discover')}
            />
          </View>
        ) : nothingNearby ? (
          <View style={styles.overlayContent}>
            <EmptyState
              title={zip ? `Nothing mapped near ${zip}` : 'No location set yet'}
              message={
                zip
                  ? `We couldn't find resources within ${radiusMiles} miles. A wider search radius, or a nearby ZIP, usually finds more.`
                  : 'Add a ZIP code and we can show the help closest to you.'
              }
              actionLabel={zip ? 'Change ZIP or radius' : 'Set your location'}
              onAction={() => router.navigate('/profile')}
            />
          </View>
        ) : results.length > 0 ? (
          // Includes a failed refresh that still has pins (the banner reports it).
          // A plain View: a native map mounted inside an entering animation can
          // paint blank, so `ResourceMap` owns its own reveal.
          <View style={styles.fill}>
            <ResourceMap
              results={visibleResults}
              selectedId={selectedId}
              onSelect={setSelectedId}
              fitToken={fitToken}
            />
          </View>
        ) : state.status === 'error' ? (
          <View style={styles.overlayContent}>
            <ErrorState error={state.error} onRetry={reload} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  // The heavy rule where the map begins; a hairline vanished against the map's paper tone.
  header: {
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.rule,
  },
  masthead: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, marginBottom: spacing.lg },
  banner: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  mapArea: { flex: 1 },
  overlayContent: { flex: 1, paddingHorizontal: spacing.xl },
});
