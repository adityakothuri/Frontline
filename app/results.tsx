import { useMemo, useState } from 'react';
import { View, FlatList, LayoutAnimation, ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppText,
  ErrorState,
  NavigatorDisclaimer,
  PrimaryButton,
  ScreenContainer,
  Skeleton,
} from '@/components';
import { colors, radii, spacing } from '@/theme';
import { useProfile } from '@/services/profile';
import { CrisisBanner } from '@/features/resources/CrisisBanner';
import { ResourceCard } from '@/features/resources/ResourceCard';
import { ResourceMap } from '@/features/resources/ResourceMap';
import { OfficialSourcesWidget } from '@/features/resources/OfficialSourcesWidget';
import { ViewToggle, type ResultsView } from '@/features/resources/ViewToggle';
import { useResourceSearch } from '@/features/resources/useResourceSearch';
import {
  defaultNeedForCategory,
  NEED_CATEGORY_META,
  type NeedCategory,
} from '@/types/need';

// Results for a category, as a list or a map of the same nearby resources. The
// local opportunity finder is the focus; an "Official online sources" widget sits
// below it (and in the empty state) as trusted backup.
export default function ResultsScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const params = useLocalSearchParams<{ category: NeedCategory }>();

  const need = useMemo(
    () => defaultNeedForCategory(params.category, profile?.zip, profile?.preferredRadiusMiles),
    [params.category, profile?.zip, profile?.preferredRadiusMiles],
  );

  const { state, reload } = useResourceSearch(need);
  const [view, setView] = useState<ResultsView>('list');
  // Selection is shared so the map preview and the list stay in sync across toggles.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // One-shot cross-layout ease so list⇄map doesn't snap. (No-op on web.)
  const changeView = (next: ResultsView) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setView(next);
  };

  const categoryLabel = NEED_CATEGORY_META[need.category]?.label ?? 'Resources';
  // The Emergency path routes to real crisis lines before anything else — the
  // banner must survive every branch (list, map, empty), so it's decided once.
  const isEmergency = need.category === 'emergency';

  // Map view is the whole screen — edge-to-edge under the header, with the toggle
  // floating over it — so it reads as a real map, not a widget.
  if (state.status === 'ready' && state.results.length > 0 && view === 'map') {
    return (
      <View style={styles.mapScreen}>
        <Stack.Screen options={{ title: categoryLabel }} />
        {isEmergency ? (
          <View style={styles.mapCrisis}>
            <CrisisBanner />
          </View>
        ) : null}
        {/* No NavigatorDisclaimer here on purpose — a floating caption over the
            map would be noise; the list, empty, and detail views all carry it. */}
        <View style={styles.mapWrap}>
          <ResourceMap
            results={state.results}
            needCategory={need.category}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <View style={styles.toggleFloat}>
            <ViewToggle value={view} onChange={changeView} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: categoryLabel }} />
      {/* Crisis routing depends on nothing async — it must survive loading and
          error states too, not just results. */}
      {isEmergency ? <CrisisBanner style={styles.crisis} /> : null}
      {state.status === 'loading' ? (
        <ResultsSkeleton />
      ) : state.status === 'error' ? (
        <ErrorState onRetry={reload} />
      ) : state.results.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyMsg}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={26} color={colors.textSecondary} />
            </View>
            <AppText variant="heading" style={styles.center}>
              No {categoryLabel.toLowerCase()} resources nearby
            </AppText>
            <AppText variant="body" color="textSecondary" style={styles.emptyText}>
              We couldn&apos;t find local {categoryLabel.toLowerCase()} resources
              {profile?.zip ? ` near ${profile.zip}` : ''}. Try updating your location — and the
              official sources below can still help.
            </AppText>
            <PrimaryButton
              label="Update location"
              variant="secondary"
              onPress={() => router.push('/profile')}
              style={styles.emptyBtn}
            />
          </View>
          <OfficialSourcesWidget category={need.category} />
          <NavigatorDisclaimer style={styles.disclaimer} />
        </ScrollView>
      ) : (
        <View style={styles.ready}>
          <View style={styles.headerRow}>
            <AppText variant="body" color="textSecondary">
              {state.results.length} {state.results.length === 1 ? 'resource' : 'resources'}
            </AppText>
            <ViewToggle value={view} onChange={changeView} />
          </View>
          <FlatList
            style={styles.fill}
            data={state.results}
            keyExtractor={(item) => item.resource.id}
            renderItem={({ item }) => (
              <ResourceCard result={item} needCategory={need.category} />
            )}
            ListFooterComponent={
              <>
                <OfficialSourcesWidget category={need.category} />
                <NavigatorDisclaimer style={styles.disclaimer} />
              </>
            }
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

// Card-shaped placeholders where the results will land, so the page doesn't
// jump from a centered spinner to a full list.
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
        <View key={i} style={styles.skeletonCard}>
          <Skeleton width="55%" height={18} />
          <Skeleton width="35%" />
          <Skeleton width="80%" />
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
  },
  fill: { flex: 1 },
  list: { gap: spacing.md, paddingBottom: spacing.xl },
  emptyScroll: { paddingBottom: spacing.xl },
  emptyMsg: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  emptyText: { textAlign: 'center', maxWidth: 320 },
  emptyBtn: { marginTop: spacing.md, paddingHorizontal: spacing.xxl },
  mapScreen: { flex: 1, backgroundColor: colors.background },
  crisis: { marginBottom: spacing.lg },
  mapCrisis: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  // Keeps the floating toggle anchored to the map, not the screen, so the
  // crisis banner above can't sit under it.
  mapWrap: { flex: 1 },
  toggleFloat: { position: 'absolute', top: spacing.sm, right: spacing.md },
  disclaimer: { marginTop: spacing.lg },
  skeletons: { gap: spacing.md },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
