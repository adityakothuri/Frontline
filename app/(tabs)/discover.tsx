import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppText,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  LocationButton,
  PressableScale,
} from '@/components';
import { colors, radii, spacing } from '@/theme';
import {
  resourceService,
  resourceToNeedCategory,
  type ResourceSearchResult,
} from '@/services/resources';
import { useProfile } from '@/services/profile';
import { ResourceCard } from '@/features/resources/ResourceCard';
import { NeedCategoryCard } from '@/features/needs/NeedCategoryCard';
import { CategoryShells, shellCategory, type ShellId } from '@/features/discover/CategoryShells';
import { NEED_CATEGORIES, DEFAULT_RADIUS_MILES, type NeedCategory } from '@/types/need';

type BrowseState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; results: ResourceSearchResult[] };

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

// Browse opportunities: a curated shell row over all opportunities (or one
// category), with an "Other" shell that opens the full category list.
export default function DiscoverScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const [selected, setSelected] = useState<ShellId>('all');
  const [miscOpen, setMiscOpen] = useState(false);
  const [state, setState] = useState<BrowseState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const results = await resourceService.listResources(
        shellCategory(selected),
        profile?.zip,
        profile?.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES,
      );
      setState({ status: 'ready', results });
    } catch {
      setState({ status: 'error' });
    }
  }, [selected, profile?.zip, profile?.preferredRadiusMiles]);

  useEffect(() => {
    if (selected === 'other') return;
    load();
  }, [selected, load]);

  // The multi-category "all" browse alternates categories; a single category
  // keeps its natural nearest-first order.
  const displayResults = useMemo(() => {
    if (state.status !== 'ready') return [];
    return shellCategory(selected) === undefined
      ? interleaveByCategory(state.results)
      : state.results;
  }, [state, selected]);

  const handleSelect = (id: ShellId) => {
    setSelected(id);
    setMiscOpen(false);
  };

  const openCategory = (category: NeedCategory) =>
    router.push({ pathname: '/results', params: { category } });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <LocationButton zip={profile?.zip} onPress={() => router.navigate('/profile')} />
      </View>

      <View style={styles.header}>
        <AppText variant="title">Discover</AppText>
        <AppText variant="body" color="textSecondary" style={styles.subtitle}>
          Browse opportunities for veterans near you.
        </AppText>
      </View>

      <CategoryShells selected={selected} onSelect={handleSelect} />

      <View style={styles.content}>
        {selected === 'other' ? (
          miscOpen ? (
            <View style={styles.misc}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMiscOpen(false)}
                hitSlop={6}
                style={styles.backRow}
              >
                <Ionicons name="chevron-back" size={16} color={colors.accent} />
                <AppText variant="label" color="textSecondary">
                  All categories
                </AppText>
              </Pressable>
              <EmptyState
                icon="shapes-outline"
                title="Nothing here yet"
                message="Opportunities that don’t fit a category will show up here once we add them."
              />
            </View>
          ) : (
            <FlatList
              data={NEED_CATEGORIES}
              keyExtractor={(category) => category}
              renderItem={({ item }) => (
                <NeedCategoryCard category={item} onPress={() => openCategory(item)} />
              )}
              ListFooterComponent={<MiscCard onPress={() => setMiscOpen(true)} />}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : state.status === 'loading' ? (
          <Loading label="Loading opportunities…" />
        ) : state.status === 'error' ? (
          <ErrorState onRetry={load} />
        ) : displayResults.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="Nothing here yet"
            message="We don’t have opportunities in this category yet. Try another, or check back soon."
          />
        ) : (
          <FlatList
            data={displayResults}
            keyExtractor={(item) => item.resource.id}
            renderItem={({ item }) => (
              <ResourceCard
                result={item}
                needCategory={shellCategory(selected) ?? resourceToNeedCategory(item.resource.category)}
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// The "doesn't fit a rigid category" entry at the bottom of the Other list.
function MiscCard({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel="Miscellaneous" onPress={onPress}>
      <Card style={styles.miscCard}>
        <View style={styles.miscIcon}>
          <Ionicons name="shapes-outline" size={24} color={colors.textSecondary} />
        </View>
        <View style={styles.miscText}>
          <AppText variant="subtitle">Miscellaneous</AppText>
          <AppText variant="caption" color="textSecondary">
            Other opportunities that don’t fit a category
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  subtitle: { marginTop: spacing.sm },
  content: { flex: 1 },
  list: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: 0,
    paddingBottom: spacing.xl,
  },
  misc: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  miscCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  miscIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  miscText: { flex: 1, gap: 2 },
});
