import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, ErrorState, Loading, useLoadingGate, ScreenContainer } from '@/components';
import { resourceService, resourceToNeedCategory } from '@/services/resources';
import { reportDataError } from '@/services/monitoring';
import { ResourceDetail } from '@/features/resources/ResourceDetail';
import { RESOURCE_CATEGORY_META, type Resource } from '@/types/resource';
import { isNeedCategory } from '@/types/need';

type LoadState =
  | { status: 'loading' }
  // Kept so `ErrorState` can say which failure it was (offline, timeout, …).
  | { status: 'error'; error: unknown }
  | { status: 'notFound' }
  | { status: 'ready'; resource: Resource };

// Detail route for one resource. The `category` param carries the veteran's
// original need so the AI guidance keeps its context.
export default function ResourceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; category?: string }>();
  // A route can hand us an array or nothing; neither is a resource.
  const id = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;
  // Without a valid route category, it's derived from the resource once loaded.
  const routeCategory = isNeedCategory(params.category) ? params.category : null;

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by retry; the fetch stays inside the effect for its `active` guard.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (id === null) {
      setState({ status: 'notFound' });
      return;
    }
    let active = true;
    setState({ status: 'loading' });
    resourceService
      .getById(id)
      .then((resource) => {
        if (active) setState(resource ? { status: 'ready', resource } : { status: 'notFound' });
      })
      .catch((error) => {
        reportDataError('Resource detail', error);
        if (active) setState({ status: 'error', error });
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  const gate = useLoadingGate(state.status === 'loading');
  // Titled by category: the page's hero already shows the name.
  const title =
    state.status === 'ready' ? RESOURCE_CATEGORY_META[state.resource.category].label : '';

  // `holding` lets a visible shield finish before the page cuts in.
  if (state.status === 'ready' && !gate.holding) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <ResourceDetail
          resource={state.resource}
          needCategory={routeCategory ?? resourceToNeedCategory(state.resource.category)}
        />
      </>
    );
  }

  return (
    <ScreenContainer edges={['bottom']}>
      <Stack.Screen options={{ title }} />
      {gate.holding ? (
        gate.showShield ? (
          <Loading label="Loading resource…" />
        ) : null
      ) : state.status === 'error' ? (
        <ErrorState error={state.error} onRetry={retry} />
      ) : (
        <EmptyState
          title="This place isn’t listed any more"
          message="It may have closed or been removed from our sources. Nearby help is one step back."
          actionLabel="Go back"
          onAction={() => (router.canGoBack() ? router.back() : router.replace('/discover'))}
        />
      )}
    </ScreenContainer>
  );
}
