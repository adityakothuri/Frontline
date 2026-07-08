import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  EmptyState,
  ErrorState,
  Loading,
  ScreenContainer,
} from '@/components';
import { spacing } from '@/theme';
import { resourceService, type ResourceSearchResult } from '@/services/resources';
import { ResourceCard } from '@/features/resources/ResourceCard';
import {
  DEFAULT_RADIUS_MILES,
  NEED_CATEGORY_META,
  type HelpType,
  type Modality,
  type Need,
  type NeedCategory,
  type Urgency,
  type VeteranDocument,
} from '@/types/need';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; results: ResourceSearchResult[] };

// Results for a Need: the same data that will also feed the map (Phase 5).
export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category: NeedCategory;
    urgency: Urgency;
    modality: Modality;
    helpType: HelpType;
    documents: string;
    zip: string;
    radius: string;
  }>();

  const need = useMemo<Need>(
    () => ({
      category: params.category,
      urgency: params.urgency,
      modality: params.modality,
      helpType: params.helpType,
      documentsOnHand: params.documents
        ? (params.documents.split(',').filter(Boolean) as VeteranDocument[])
        : [],
      location: {
        zip: params.zip || undefined,
        radiusMiles: Number(params.radius) || DEFAULT_RADIUS_MILES,
      },
    }),
    [params.category, params.urgency, params.modality, params.helpType, params.documents, params.zip, params.radius],
  );

  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const results = await resourceService.search({ need });
      setState({ status: 'ready', results });
    } catch {
      setState({ status: 'error' });
    }
  }, [need]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryLabel = NEED_CATEGORY_META[need.category]?.label ?? 'Resources';

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Nearby resources' }} />
      {state.status === 'loading' ? (
        <Loading label="Finding nearby resources…" />
      ) : state.status === 'error' ? (
        <ErrorState onRetry={load} />
      ) : state.results.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No resources found nearby"
          message={`We couldn't find ${categoryLabel.toLowerCase()} resources in range. Try a wider search or a different ZIP.`}
          actionLabel="Adjust search"
          onAction={() => router.back()}
        />
      ) : (
        <FlatList
          style={styles.listContainer}
          data={state.results}
          keyExtractor={(item) => item.resource.id}
          renderItem={({ item }) => <ResourceCard result={item} />}
          ListHeaderComponent={
            <AppText variant="body" color="textSecondary" style={styles.count}>
              {state.results.length}{' '}
              {state.results.length === 1 ? 'resource' : 'resources'} for {categoryLabel.toLowerCase()}
            </AppText>
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContainer: { flex: 1 },
  list: { gap: spacing.md, paddingBottom: spacing.xl },
  count: { marginBottom: spacing.sm },
});
