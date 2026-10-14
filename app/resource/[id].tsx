import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { EmptyState, ErrorState, Loading, useLoadingGate, ScreenContainer } from '@/components';
import { invalidateResourceCache, resourceService } from '@/services/resources';
import { reportDataError } from '@/services/monitoring';
import { ResourceDetail } from '@/features/resources/ResourceDetail';
import type { Resource } from '@/types/resource';
import type { NeedCategory } from '@/types/need';

type LoadState =
  | { status: 'loading' }
  // The error is kept, not just the fact of one. `ErrorState` reads it to tell a
  // veteran which wall they hit — offline, a timeout, a misconfigured backend —
  // and dropping it here meant every failure on this page, whatever its cause,
  // rendered the same "Something went wrong". The Map tab already does this.
  | { status: 'error'; error: unknown }
  | { status: 'notFound' }
  | { status: 'ready'; resource: Resource };

// Detail route for a single resource. Reached by tapping a card; the `category`
// param carries the veteran's original need so the AI guidance keeps its context.
// Save lives in the page's action row, not the header.
export default function ResourceDetailScreen() {
  const { id, category } = useLocalSearchParams<{ id: string; category?: NeedCategory }>();
  const needCategory: NeedCategory = category ?? 'va_benefits';

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by the retry so the effect re-runs; keeping the fetch inside the
  // effect is what gives it an `active` guard, so a response that lands after
  // the veteran has already gone back doesn't set state on a dead screen.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    resourceService
      .getById(id)
      .then((resource) => {
        if (active) setState(resource ? { status: 'ready', resource } : { status: 'notFound' });
      })
      .catch((error) => {
        // A real backend can fail here — distinct from "not found", and retryable.
        reportDataError('Resource detail', error);
        if (active) setState({ status: 'error', error });
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => {
    invalidateResourceCache();
    setAttempt((n) => n + 1);
  }, []);

  const gate = useLoadingGate(state.status === 'loading', state.status === 'error');
  const title = state.status === 'ready' ? state.resource.name : 'Resource';

  // `holding` keeps the shield up through its finale, so the page does not cut
  // in over the celebration the moment the resource lands.
  if (state.status === 'ready' && !gate.holding) {
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
      {gate.holding ? (
        gate.showShield ? (
          <Loading label="Loading resource…" done={gate.done} onFinish={gate.finish} />
        ) : null
      ) : state.status === 'error' ? (
        <ErrorState error={state.error} onRetry={retry} />
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
