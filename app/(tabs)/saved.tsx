import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import { colors, durations, pressScale, radii, spacing } from '@/theme';
import { fadeOut, riseIn, stepDelay } from '@/theme/motionPresets';
import { useStaggerGate } from '@/hooks/useStaggerGate';
import { isOpenNow } from '@/lib/hours';
import {
  invalidateResourceCache,
  resourceService,
  resourceToNeedCategory,
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
  const { savedIds, isHydrated, toggleSave } = useSaved();
  const { refreshSnapshots } = useReminders();
  const [resolved, setResolved] = useState<Record<string, Resource>>({});
  // Ids the backend no longer knows. They used to look exactly like ids that
  // had not resolved yet: refetched on every change, never drawn, and impossible
  // to unsave from this tab — a veteran whose only saved place had closed saw
  // "Nothing saved yet" over a list that was not empty.
  const [retired, setRetired] = useState<Set<string>>(() => new Set());
  const [resolving, setResolving] = useState(false);
  const [resolveFailed, setResolveFailed] = useState(false);
  const [resolveError, setResolveError] = useState<unknown>(undefined);
  // Bumped by the error-state retry to re-run the resolve effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const missing = savedIds.filter((id) => !(id in resolved) && !retired.has(id));
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
        // A clean `null` is the backend saying "gone", not a failure to ask.
        setRetired((prev) => {
          const gone = missing.filter(
            (id, i) => outcomes[i].status === 'fulfilled' && outcomes[i].value === null,
          );
          if (gone.length === 0) return prev;
          return new Set([...prev, ...gone]);
        });
        // Any failure is remembered; whether it earns the whole screen or a banner
        // is decided at render time by what else there is to show. It used to
        // count only a *total* failure, so one retired id plus one network failure
        // read as "that place is no longer listed" with the other quietly missing.
        setResolveFailed(failures.length > 0);
        setResolveError(failures[0]?.reason);
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
    invalidateResourceCache();
    setAttempt((n) => n + 1);
  };

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

  const firstLoad =
    !isHydrated ||
    (savedIds.length > 0 && items.length === 0 && retiredIds.length === 0 && resolving);
  const gate = useLoadingGate(firstLoad, resolveFailed);
  // Only the first screenful, and only on the first paint after the list settles.
  const staggered = useStaggerGate(isHydrated);

  // Live, like every other masthead: a count once there is one, the promise
  // until then. Held back until the store hydrates so the line never flips
  // from "nothing" to a number on the first paint.
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
          <Loading label="Loading your saved resources…" done={gate.done} onFinish={gate.finish} />
        ) : null
      ) : resolveFailed && items.length === 0 && savedIds.length > 0 ? (
        // Nothing drawable and at least one read failed: the whole screen, even
        // if some of the missing rows are retired rather than failed — a retry
        // is the only thing that can tell the veteran which is which.
        <ErrorState error={resolveError} onRetry={retryResolve} />
      ) : items.length === 0 && retiredIds.length > 0 ? (
        // Everything saved has since left the catalogue. Say so, and offer the
        // one action that fixes it — the list really is empty otherwise.
        <EmptyState
          icon="bookmark-outline"
          title={
            retiredIds.length === 1
              ? 'That place is no longer listed'
              : 'Those places are no longer listed'
          }
          message="They may have closed or been removed from our sources. You can clear them and keep looking."
          actionLabel="Clear them"
          onAction={forgetRetired}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="Nothing saved yet"
          message="Tap the bookmark on any place to keep it here for later."
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
              <ResourceCard
                result={item}
                needCategory={resourceToNeedCategory(item.resource.category)}
              />
            </Animated.View>
          )}
          itemLayoutAnimation={LinearTransition.duration(durations.base)}
          // Some rows failed to load while others drew: say so above the list
          // rather than letting them go missing in silence.
          ListHeaderComponent={
            resolveFailed ? (
              <RefreshFailedBanner error={resolveError} onRetry={retryResolve} />
            ) : null
          }
          // A quiet line, not a card per retired id: there is no name left to
          // show for them, only the fact and the way to tidy it.
          ListFooterComponent={
            retiredIds.length > 0 ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${retiredIds.length} saved ${retiredIds.length === 1 ? 'place is' : 'places are'} no longer listed. Remove ${retiredIds.length === 1 ? 'it' : 'them'}.`}
                onPress={forgetRetired}
                scaleTo={pressScale.chip}
                style={styles.retiredRow}
              >
                <Ionicons name="archive-outline" size={16} color={colors.textSecondary} />
                <View style={styles.retiredCopy}>
                  <AppText variant="caption" color="textSecondary">
                    {retiredIds.length} saved {retiredIds.length === 1 ? 'place is' : 'places are'}{' '}
                    no longer listed
                  </AppText>
                </View>
                <AppText variant="caption" color="accentPressed">
                  Remove
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
  list: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl },
  retiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  retiredCopy: { flex: 1 },
});
