import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { EmptyState, ErrorState, Loading, ScreenContainer, ScreenHeader } from '@/components';
import { spacing } from '@/theme';
import { isOpenNow } from '@/lib/hours';
import { resourceService, type ResourceSearchResult } from '@/services/resources';
import { useSaved } from '@/services/saved';
import { ResourceCard } from '@/features/resources/ResourceCard';
import type { Resource } from '@/types/resource';

// The Saved tab. `savedIds` is the source of truth for membership + order; we
// resolve each id to live data once (cached), so unsaving here removes the row
// instantly and trust signals never come from a stale snapshot.
export default function SavedScreen() {
  const { savedIds, isHydrated } = useSaved();
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
    Promise.all(missing.map((id) => resourceService.getById(id)))
      .then((results) => {
        if (!active) return;
        setResolved((prev) => {
          const next = { ...prev };
          for (const r of results) if (r) next[r.id] = r;
          return next;
        });
      })
      .catch(() => {
        // A real backend can fail here — surface it instead of hanging forever.
        if (active) setResolveFailed(true);
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

  const firstLoad = !isHydrated || (savedIds.length > 0 && items.length === 0 && resolving);

  return (
    <ScreenContainer>
      <ScreenHeader title="Saved" subtitle="Your resources, in one place" />
      {firstLoad ? (
        <Loading label="Loading your saved resources…" />
      ) : resolveFailed && items.length === 0 && savedIds.length > 0 ? (
        <ErrorState onRetry={() => setAttempt((n) => n + 1)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="Nothing saved yet"
          message="Tap the bookmark on any opportunity to save it here for later."
        />
      ) : (
        <FlatList
          style={styles.fill}
          data={items}
          keyExtractor={(item) => item.resource.id}
          renderItem={({ item }) => <ResourceCard result={item} needCategory="general_benefits" />}
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
