import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import {
  EmptyState,
  ErrorState,
  Loading,
  useLoadingGate,
  ScreenContainer,
  ScreenHeader,
} from '@/components';
import { durations, spacing } from '@/theme';
import { fadeOut, riseIn, stepDelay } from '@/theme/motionPresets';
import { useStaggerGate } from '@/hooks/useStaggerGate';
import { isOpenNow } from '@/lib/hours';
import {
  invalidateResourceCache,
  resourceService,
  type ResourceSearchResult,
} from '@/services/resources';
import { useSaved } from '@/services/saved';
import { useReminders } from '@/services/reminders';
import { reportDataError } from '@/services/monitoring';
import { ResourceCard } from '@/features/resources/ResourceCard';
import { toReminderSnapshot } from '@/features/resources/resourceStatus';
import type { Resource } from '@/types/resource';

// The Saved tab. `savedIds` is the source of truth for membership + order; we
// resolve each id to live data once (cached), so unsaving here removes the row
// instantly and trust signals never come from a stale snapshot.
export default function SavedScreen() {
  const { savedIds, isHydrated } = useSaved();
  const { refreshSnapshots } = useReminders();
  const [resolved, setResolved] = useState<Record<string, Resource>>({});
  const [resolving, setResolving] = useState(false);
  const [resolveFailed, setResolveFailed] = useState(false);
  // Bumped by the error-state retry to re-run the resolve effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const missing = savedIds.filter((id) => !(id in resolved));
    if (missing.length === 0) return;
    let active = true;
    setResolving(true);
    setResolveFailed(false);
    // allSettled, not all: these are independent reads, and one id that fails
    // (or has been retired from the catalogue) should cost the veteran that one
    // row — not the whole list, which is what a rejected Promise.all did.
    Promise.allSettled(missing.map((id) => resourceService.getById(id)))
      .then((outcomes) => {
        if (!active) return;
        const failures = outcomes.filter((o) => o.status === 'rejected');
        for (const failure of failures) {
          // A real backend can fail here — surface it instead of hanging forever.
          reportDataError('Saved', failure.reason);
        }
        setResolved((prev) => {
          const next = { ...prev };
          for (const outcome of outcomes) {
            if (outcome.status === 'fulfilled' && outcome.value)
              next[outcome.value.id] = outcome.value;
          }
          return next;
        });
        // Only a total failure is worth an error screen; a partial one still has
        // resources to show, and the list simply comes back short.
        setResolveFailed(failures.length === outcomes.length);
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

  const items = useMemo<ResourceSearchResult[]>(
    () =>
      savedIds
        .map((id) => resolved[id])
        .filter((r): r is Resource => Boolean(r))
        .map((resource) => ({
          resource,
          distanceMiles: null,
          isOpenNow: isOpenNow(resource.hours),
        })),
    [savedIds, resolved],
  );

  // This screen resolves every saved resource anyway, which makes it the one
  // place reminder snapshots can be refreshed for free — no extra request, and
  // a pantry whose hours changed upstream quietly gets a corrected schedule.
  useEffect(() => {
    refreshSnapshots(
      items.map(({ resource }) => ({
        resourceId: resource.id,
        snapshot: toReminderSnapshot(resource),
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const firstLoad = !isHydrated || (savedIds.length > 0 && items.length === 0 && resolving);
  const gate = useLoadingGate(firstLoad, resolveFailed);
  // Only the first screenful, and only on the first paint after the list settles.
  const staggered = useStaggerGate(isHydrated);

  return (
    <ScreenContainer>
      <ScreenHeader title="Saved" subtitle="Your resources, in one place" />
      {gate.holding ? (
        gate.showShield ? (
          <Loading label="Loading your saved resources…" done={gate.done} onFinish={gate.finish} />
        ) : null
      ) : resolveFailed && items.length === 0 && savedIds.length > 0 ? (
        <ErrorState
          onRetry={() => {
            invalidateResourceCache();
            setAttempt((n) => n + 1);
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="Nothing saved yet"
          message="Tap the bookmark on any opportunity to save it here for later."
        />
      ) : (
        // This is the one list where the rows change under the veteran: unsaving
        // fades the row out and slides the rest up, rather than snapping the gap
        // shut. Cheap here because the list is short — deliberately not done on
        // Discover, where a per-item layout animation across a large result set
        // would cost far more than it is worth.
        <Animated.FlatList
          style={styles.fill}
          data={items}
          keyExtractor={(item) => item.resource.id}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={staggered(index) ? riseIn(stepDelay(index)) : undefined}
              exiting={fadeOut()}
            >
              <ResourceCard result={item} needCategory="va_benefits" />
            </Animated.View>
          )}
          itemLayoutAnimation={LinearTransition.duration(durations.base)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl },
});
