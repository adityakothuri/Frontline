import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  AppText,
  EmptyState,
  ErrorState,
  Loading,
  useLoadingGate,
  PressableScale,
  RefreshFailedBanner,
  ScreenContainer,
  ScreenHeader,
} from '@/components';
import { durations, pressScale, spacing } from '@/theme';
import { fadeOut, riseIn, stepDelay } from '@/theme/motionPresets';
import { useStaggerGate } from '@/hooks/useStaggerGate';
import { isOpenNow } from '@/lib/hours';
import { distanceMiles, type Coordinates } from '@/lib/geo';
import {
  resourceService,
  resourceToNeedCategory,
  type ResourceSearchResult,
} from '@/services/resources';
import { useSaved } from '@/services/saved';
import { useProfile } from '@/services/profile';
import { resolveZipCentroid } from '@/services/location';
import { useReminders } from '@/services/reminders';
import { reportDataError } from '@/services/monitoring';
import { ResourceCard } from '@/features/resources/ResourceCard';
import { toReminderSnapshot } from '@/features/resources/resourceStatus';
import type { Resource } from '@/types/resource';

// The Saved tab. `savedIds` is the source of truth for membership and order; the
// ids resolve to live data in one cached request, so trust signals are never
// read from a stale snapshot.
export default function SavedScreen() {
  const router = useRouter();
  const { savedIds, isHydrated, toggleSave } = useSaved();
  const { refreshSnapshots } = useReminders();
  const { profile } = useProfile();
  const [resolved, setResolved] = useState<Record<string, Resource>>({});
  // Ids the backend no longer returns: the place closed or left our sources.
  // Tracked apart from unresolved ids so they can be shown and cleared.
  const [retired, setRetired] = useState<Set<string>>(() => new Set());
  const [resolving, setResolving] = useState(false);
  const [resolveFailed, setResolveFailed] = useState(false);
  const [resolveError, setResolveError] = useState<unknown>(undefined);
  // Bumped by the error-state retry to re-run the resolve effect.
  const [attempt, setAttempt] = useState(0);
  // Distances are measured from the veteran's ZIP, the same origin search uses.
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const zip = profile?.zip;

  useEffect(() => {
    if (!zip) {
      setOrigin(null);
      return;
    }
    let active = true;
    resolveZipCentroid(zip).then((centroid) => {
      if (active) setOrigin(centroid);
    });
    return () => {
      active = false;
    };
  }, [zip]);

  useEffect(() => {
    const missing = savedIds.filter((id) => !(id in resolved) && !retired.has(id));
    if (missing.length === 0) return;
    let active = true;
    setResolving(true);
    setResolveFailed(false);
    // One request for every id still missing. An id the backend doesn't return
    // is retired; a failed request retires nothing.
    resourceService
      .getByIds(missing)
      .then((found) => {
        if (!active) return;
        setResolved((prev) => {
          const next = { ...prev };
          for (const [id, resource] of found) next[id] = resource;
          return next;
        });
        setRetired((prev) => {
          const gone = missing.filter((id) => !found.has(id));
          if (gone.length === 0) return prev;
          return new Set([...prev, ...gone]);
        });
        setResolveFailed(false);
        setResolveError(undefined);
      })
      .catch((error: unknown) => {
        if (!active) return;
        // Full screen or banner is decided at render time by what else can be shown.
        reportDataError('Saved', error);
        setResolveFailed(true);
        setResolveError(error);
      })
      .finally(() => {
        if (active) setResolving(false);
      });
    return () => {
      active = false;
    };
    // Resolve only the ids we don't have yet (or when a retry is requested).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIds, attempt]);

  // Saved ids the catalogue has retired, in the veteran's order.
  const retiredIds = useMemo(() => savedIds.filter((id) => retired.has(id)), [savedIds, retired]);
  const forgetRetired = () => {
    for (const id of retiredIds) toggleSave(id);
  };
  const retryResolve = () => {
    setAttempt((n) => n + 1);
  };

  const items = useMemo<ResourceSearchResult[]>(
    () =>
      savedIds
        .map((id) => resolved[id])
        .filter((r): r is Resource => Boolean(r))
        .map((resource) => ({
          resource,
          distanceMiles:
            origin && resource.latitude !== null && resource.longitude !== null
              ? distanceMiles(origin, {
                  latitude: resource.latitude,
                  longitude: resource.longitude,
                })
              : null,
          isOpenNow: isOpenNow(resource.hours),
        })),
    [savedIds, resolved, origin],
  );

  // Every saved resource is resolved here anyway, so reminder snapshots refresh
  // for free and a reminder follows hours that changed upstream.
  useEffect(() => {
    refreshSnapshots(
      items.map(({ resource }) => ({
        resourceId: resource.id,
        snapshot: toReminderSnapshot(resource),
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const firstLoad =
    !isHydrated ||
    (savedIds.length > 0 && items.length === 0 && retiredIds.length === 0 && resolving);
  const gate = useLoadingGate(firstLoad);
  const staggered = useStaggerGate(isHydrated);

  // Held back until the store hydrates so the line never flips from nothing to a number.
  const count = items.length;
  const subtitle = !isHydrated
    ? undefined
    : count === 0
      ? 'Places you want to come back to'
      : `${count} ${count === 1 ? 'place' : 'places'} you want to come back to`;

  return (
    <ScreenContainer>
      <ScreenHeader title="Saved" subtitle={subtitle} subtitleKey={subtitle} />
      {gate.holding ? (
        gate.showShield ? (
          <Loading label="Loading your saved resources…" />
        ) : null
      ) : resolveFailed && items.length === 0 && savedIds.length > 0 ? (
        // Nothing drawable and a read failed: only a retry can tell retired from failed.
        <ErrorState error={resolveError} onRetry={retryResolve} />
      ) : items.length === 0 && retiredIds.length > 0 ? (
        <EmptyState
          title="No longer listed"
          message="They may have closed or been removed from our sources. You can clear them and keep looking."
          actionLabel="Clear them"
          onAction={forgetRetired}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          message="Tap the bookmark on any place to keep it here for later."
          actionLabel="Find help nearby"
          onAction={() => router.navigate('/discover')}
        />
      ) : (
        // Unsaving fades the row out and slides the rest up. Affordable because
        // this list is short; Discover's long lists skip the layout animation.
        <Animated.FlatList
          style={styles.fill}
          data={items}
          keyExtractor={(item) => item.resource.id}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={staggered(index) ? riseIn(stepDelay(index)) : undefined}
              exiting={fadeOut()}
            >
              <ResourceCard
                result={item}
                needCategory={resourceToNeedCategory(item.resource.category)}
              />
            </Animated.View>
          )}
          itemLayoutAnimation={LinearTransition.duration(durations.base)}
          // Some rows failed while others drew: say so rather than drop them silently.
          ListHeaderComponent={
            resolveFailed ? (
              <RefreshFailedBanner error={resolveError} onRetry={retryResolve} />
            ) : null
          }
          // One quiet line for all retired ids: there is no name left to show.
          ListFooterComponent={
            retiredIds.length > 0 ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${retiredIds.length} saved ${retiredIds.length === 1 ? 'place is' : 'places are'} no longer listed. Remove ${retiredIds.length === 1 ? 'it' : 'them'}.`}
                onPress={forgetRetired}
                scaleTo={pressScale.chip}
                style={styles.retiredRow}
              >
                <View style={styles.retiredCopy}>
                  <AppText variant="caption" color="textSecondary">
                    {retiredIds.length} saved {retiredIds.length === 1 ? 'place is' : 'places are'}{' '}
                    no longer listed
                  </AppText>
                </View>
                <AppText variant="data" color="accent">
                  Remove ▸
                </AppText>
              </PressableScale>
            ) : null
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingBottom: spacing.xl },
  retiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  retiredCopy: { flex: 1 },
});
