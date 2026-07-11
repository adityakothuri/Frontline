import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { EmptyState, Loading, ScreenContainer } from '@/components';
import { resourceService } from '@/services/resources';
import { ResourceDetail } from '@/features/resources/ResourceDetail';
import type { Resource } from '@/types/resource';
import type { NeedCategory } from '@/types/need';

type LoadState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'ready'; resource: Resource };

// Detail route for a single resource. Reached by tapping a card; the `category`
// param carries the veteran's original need so the AI guidance keeps its context.
// Save lives in the page's action row, not the header.
export default function ResourceDetailScreen() {
  const { id, category } = useLocalSearchParams<{ id: string; category?: NeedCategory }>();
  const needCategory: NeedCategory = category ?? 'general_benefits';

  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const resource = await resourceService.getById(id);
    setState(resource ? { status: 'ready', resource } : { status: 'notFound' });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const title = state.status === 'ready' ? state.resource.name : 'Resource';

  if (state.status === 'ready') {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <ResourceDetail resource={state.resource} needCategory={needCategory} />
      </>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title }} />
      {state.status === 'loading' ? (
        <Loading label="Loading resource…" />
      ) : (
        <EmptyState
          icon="help-circle-outline"
          title="Resource not found"
          message="We couldn’t find this resource. It may have been removed."
        />
      )}
    </ScreenContainer>
  );
}
