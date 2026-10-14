import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppText,
  EmptyState,
  ErrorState,
  Loading,
  useLoadingGate,
  LocationButton,
  RefreshFailedBanner,
} from '@/components';
import { colors, durations, spacing } from '@/theme';
import { fadeIn } from '@/theme/motionPresets';
import { tapSelection } from '@/lib/haptics';
import { invalidateResourceCache, resourceService } from '@/services/resources';
import { useProfile } from '@/services/profile';
import { reportDataError } from '@/services/monitoring';
import { ResourceMap } from '@/features/resources/ResourceMap';
import { MapCategoryFilter } from '@/features/resources/MapCategoryFilter';
import { resultsOf, type ResourceSearchState } from '@/features/resources/useResourceSearch';
import { RESOURCE_CATEGORIES, type ResourceCategory } from '@/types/resource';
import { DEFAULT_RADIUS_MILES } from '@/types/need';

// The dedicated Map tab: every located opportunity as a category pin, one tap
// from anywhere.
//
// The layout is the app's ordinary one: a paper header band carrying the
// location pill, a serif hero with a live subtitle, and the category filter —
// with the map filling everything below it. Same `SafeAreaView`, same
// `spacing.xl` gutters, same `lg / md` rhythm and the same title-then-subtitle
// hero as Discover and Home.
//
// It took three tries to get back here. The map was framed in a card; then
// full-bleed under two opaque slabs; then full-bleed under floating capsules and
// a draggable sheet. Each pass drifted further from how the rest of the app
// looks, and the sheet and the floating chrome were both rejected outright. The
// map stays big — that part was asked for — but nothing hovers over it any more,
// which is why this file no longer measures its own chrome or hands insets down
// to the camera.
//
// The Map tab deliberately lists nothing; Discover and Results are the list
// surfaces, and the empty states below route there when nothing can be pinned.
export default function MapScreen() {
  const router = useRouter();
  const { profile, isHydrated: isProfileHydrated } = useProfile();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [state, setState] = useState<ResourceSearchState>({ status: 'loading', stale: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which categories are switched off. Hidden rather than shown, so a category
  // that only appears after a ZIP change arrives visible instead of silently
  // missing from a map the veteran never filtered.
  const [hidden, setHidden] = useState<Set<ResourceCategory>>(() => new Set());

  // Bumped to tell `ResourceMap` to re-frame the camera on the current pins. The
  // camera lives over there; this is how the screen reaches it without owning it.
  const [fitToken, setFitToken] = useState(0);

  // Arriving from a "See in map" tap elsewhere: focus that pin. ResourceMap
  // glides to it once results are loaded (its own effect keys off selectedId).
  // Only once the results actually contain it — a stale focus id would otherwise
  // pin `selectedId` to something that can never render a card.
  //
  // The param is consumed by *clearing* it, not by remembering it was used. A
  // remembered id was consumed once for the lifetime of the tab, and this tab
  // never unmounts: tapping "See in map" on the same resource a second time
  // re-sent an identical `focus`, the memory rejected it, and the button silently
  // did nothing. Clearing keeps the guard that mattered — a later refetch must
  // not re-open a preview the veteran already closed, and by then there is no
  // param left to re-read — while letting an identical navigation arrive as a
  // new one.
  useEffect(() => {
    if (typeof focus !== 'string' || focus.length === 0) return;
    const target = resultsOf(state).find((r) => r.resource.id === focus);
    if (!target) return;
    router.setParams({ focus: undefined });
    // A focus id landing in a switched-off category used to select nothing and
    // say nothing: `selectedId` was set, the filtered map drew no card for it,
    // and the veteran arrived at a map that looked untouched. Showing the
    // category is the smaller surprise, and its chip above reports the change.
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
    invalidateResourceCache();
    setReloadToken((n) => n + 1);
  }, []);
  const stateStatus = state.status;

  // Returning to a failed tab retries for the veteran — see discover.tsx.
  useFocusEffect(
    useCallback(() => {
      if (stateStatus === 'error') reload();
    }, [stateStatus, reload]),
  );

  const zip = profile?.zip;
  const radiusMiles = profile?.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES;

  // The pins on screen: the fresh results, or the last good set when a refresh
  // failed. Everything below reads this rather than `state.results`, so the
  // filter, map and count all agree about what is actually being shown.
  const results = resultsOf(state);

  // The shield is for a wait with nothing behind it. Gating it on `loading`
  // alone would tear the live `MapView` down for the whole quiet window on every
  // refresh — a blank frame, and the camera reset back to fit-all when it
  // remounted. A refresh that still has pins keeps them; the `RefreshFailedBanner`
  // is what reports a refresh that then failed.
  const gate = useLoadingGate(
    state.status === 'loading' && results.length === 0,
    state.status === 'error',
  );

  useEffect(() => {
    // Wait for the profile: before it hydrates there is no ZIP, so the query
    // would come back with nothing to pin and then immediately refetch.
    if (!isProfileHydrated) return;
    // `active` guards against out-of-order resolution: editing the ZIP twice in
    // quick succession must not let the older response overwrite the newer one.
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

  // Which categories are pinned and how many each has — the chips' labels, and
  // the denominator for the count. Counted over the *unfiltered* results, so a
  // chip's number describes the place, not the current filter, and never moves
  // as chips are toggled. Ordered by the canonical category order rather than by
  // frequency, so the row doesn't reshuffle itself between ZIP codes.
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

  // `hidden` is never pruned — a category switched off in one ZIP stays off if you
  // come back to it — so everything downstream reads it intersected with what is
  // actually here. Otherwise a category hidden in Dallas and absent in Austin left
  // the row showing a "Show all" reset while every visible chip was already on.
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
  // Switching every chip off is allowed — it is reversible and obvious — but it
  // needs to explain itself rather than showing a map of nothing.
  const nothingShowing = counts.length > 0 && pinned === 0;
  // A single option is not a filter. One category means one chip, which would just
  // be the old legend wearing a switch — *unless* that one category is currently
  // switched off, because then the chip is the only way back. Without the second
  // clause this is a trap: hide Food in a ZIP that has several categories, move to
  // a ZIP where Food is the only one, and the empty state below tells you to tap a
  // "Show all" that isn't rendered, with no other way out of the screen.
  const showFilter = counts.length > 1 || hiddenPresent.size > 0;

  // `ResourceMap` resolves the open resource itself, against the filtered set it
  // is handed — so a `?focus=` id landing in a switched-off category cannot open
  // a card for a pin that is not on the map.

  const toggle = useCallback(
    (category: ResourceCategory) => {
      tapSelection();
      setHidden((prev) => {
        const next = new Set(prev);
        if (!next.delete(category)) next.add(category);
        return next;
      });
      // A pin that just left the map must not keep its card open over it.
      // Turning a category back *on* can never match, so this covers both
      // directions without asking which one just happened.
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

  // A ready query that legitimately found nothing — a rural ZIP, a typo, too small
  // a radius. This used to fall through every branch to `null`: a blank screen
  // under a header claiming to describe pins.
  const nothingNearby = !gate.holding && state.status === 'ready' && results.length === 0;

  /**
   * The hero's subtitle, and the screen's only running commentary.
   *
   * It carries the count because the heading deliberately does not name the
   * screen — "Map" was the old title here, a serif restatement of the word
   * already printed on the tab bar 20pt below it. Saying what is *on* the map
   * earns the line instead.
   */
  const subtitle = useMemo(() => {
    if (state.status === 'loading' && total === 0) return 'Finding resources near you…';
    if (total === 0) return 'Nothing pinned here yet.';
    if (filtering) {
      return `Showing ${pinned} of ${total} nearby ${total === 1 ? 'place' : 'places'}.`;
    }
    const where = zip ? ` near ${zip}` : '';
    return `${total} ${total === 1 ? 'place' : 'places'}${where}, pinned by category.`;
  }, [state.status, total, filtering, pinned, zip]);

  // Every result is phone- or online-only. `counts` tallies located rows only, so
  // it comes back empty, `showFilter` is false, and both other empty states miss
  // this — leaving the veteran told that help exists, shown a map that cannot
  // draw any of it, and given nothing to press. Discover lists non-located
  // resources for the same ZIP, so it is the exit.
  const nothingMappable =
    !gate.holding &&
    state.status === 'ready' &&
    results.length > 0 &&
    !results.some((r) => r.resource.latitude !== null && r.resource.longitude !== null);

  // Re-frame the camera whenever the *place* changes, not merely the pins. This
  // covers the veteran editing their ZIP in Profile and coming back — before
  // this, the map kept the camera it was framed with on first mount and showed
  // an empty stretch of the old city.
  const framedZipRef = useRef(zip);
  useEffect(() => {
    if (framedZipRef.current === zip) return;
    framedZipRef.current = zip;
    setFitToken((n) => n + 1);
  }, [zip]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* A normal paper header band, the same one Discover and Home wear: the
          location control, the live count, then the category filter. It is a
          band and not floating chrome — the map begins below it rather than
          running under it, so nothing here needs measuring, `pointerEvents`
          juggling, or an inset handed down to the camera. */}
      <View style={styles.header}>
        <View style={styles.topBar}>
          <LocationButton zip={zip} onPress={() => router.navigate('/profile')} />
        </View>

        {/* The hero. The screen had none — just a pill and a row of chips over a
            wall of cartography — which is what made it read as unfinished next to
            Discover and Home, both of which lead with a serif title and a line of
            plain English. "Map" is deliberately not the title: it would be a
            display-serif restatement of the word already on the tab bar below. */}
        <View style={styles.heading}>
          <AppText variant="title">Nearby help</AppText>
          {/* Keyed on the sentence, so a new one arrives rather than the old one
              being overwritten in place. This line is the screen's only running
              commentary — it is how the veteran learns a chip did anything — and
              a count that swaps between frames is the one change on the screen
              small enough to miss entirely. */}
          <Animated.View key={subtitle} entering={fadeIn(0, durations.fast)}>
            <AppText variant="body" color="textSecondary" style={styles.subtitle}>
              {subtitle}
            </AppText>
          </Animated.View>
        </View>

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
              <Loading label="Loading the map…" done={gate.done} onFinish={gate.finish} />
            </View>
          ) : null
        ) : nothingShowing ? (
          <View style={styles.overlayContent}>
            {/* No action button: the olive "Show all" chip is already on screen in
                the filter row above, and two identical olive actions on one screen
                is one more primary action than this screen is allowed. */}
            <EmptyState
              icon="funnel-outline"
              title="No categories showing"
              message="Every category is switched off, so there's nothing to pin. Tap “Show all” above to bring the pins back."
            />
          </View>
        ) : nothingMappable ? (
          <View style={styles.overlayContent}>
            {/* Real places, none of them mappable. Without this the veteran gets
                `ResourceMap`'s own "Phone & online only" state, which has no
                action — help exists, the map cannot draw it, and there is nothing
                to press. Discover lists non-located resources for this ZIP. */}
            <EmptyState
              icon="call-outline"
              title="Phone & online only"
              message={`Nothing near ${zip ?? 'you'} has a street address to map — these ${results.length === 1 ? 'resource is' : 'resources are'} reached by phone or online.`}
              actionLabel="Browse them in Discover"
              onAction={() => router.navigate('/discover')}
            />
          </View>
        ) : nothingNearby ? (
          <View style={styles.overlayContent}>
            <EmptyState
              icon="map-outline"
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
          // Includes a failed refresh that still has pins: a map of real places
          // beats an error card, and the banner above says the refresh didn't land.
          <Animated.View entering={fadeIn(0, durations.reveal)} style={styles.fill}>
            <ResourceMap
              results={visibleResults}
              selectedId={selectedId}
              onSelect={setSelectedId}
              fitToken={fitToken}
            />
          </Animated.View>
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
  // The header is a band, not an overlay. A hairline under it is what separates
  // paper from cartography — the two are close enough in tone that without a line
  // the map looks like it is bleeding into the chrome.
  header: {
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  // Matches Discover and Home exactly, with the count added on the trailing edge
  // — the same `spacing.xl` gutter and the same `lg / md` vertical rhythm.
  topBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  heading: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  subtitle: { marginTop: spacing.sm },
  banner: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  // Everything below the header. The map fills it; the loading, empty and error
  // states sit inside it rather than over the whole screen.
  mapArea: { flex: 1 },
  overlayContent: { flex: 1, paddingHorizontal: spacing.xl },
});
