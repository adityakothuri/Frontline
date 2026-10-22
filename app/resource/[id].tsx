import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, ErrorState, Loading, useLoadingGate, ScreenContainer } from '@/components';
import {
  invalidateResourceCache,
  resourceService,
  resourceToNeedCategory,
} from '@/services/resources';
import { reportDataError } from '@/services/monitoring';
import { ResourceDetail } from '@/features/resources/ResourceDetail';
import { RESOURCE_CATEGORY_META, type Resource } from '@/types/resource';
import { isNeedCategory } from '@/types/need';

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
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; category?: string }>();
  // A route can hand us an array or nothing; neither is a resource.
  const id = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;
  // The need the veteran was searching, when the route carries a valid one.
  // Otherwise it is derived from the resource itself once loaded — never a
  // fixed default, which used to hand a food pantry a VA-benefits plan.
  const routeCategory = isNeedCategory(params.category) ? params.category : null;

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by the retry so the effect re-runs; keeping the fetch inside the
  // effect is what gives it an `active` guard, so a response that lands after
  // the veteran has already gone back doesn't set state on a dead screen.
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
  // The category, not the name: the hero below the header already carries the
  // name in serif, and the same string twice in 60pt of vertical space read as a
  // mistake. The category also tells a veteran arriving from a deep link where
  // in the app they are.
  const title =
    state.status === 'ready' ? RESOURCE_CATEGORY_META[state.resource.category].label : '';

  // `holding` keeps the shield up through its finale, so the page does not cut
  // in over the celebration the moment the resource lands.
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
          title="This place isn’t listed any more"
          message="It may have closed or been removed from our sources. Nearby help is one step back."
          actionLabel="Go back"
          onAction={() => (router.canGoBack() ? router.back() : router.replace('/discover'))}
        />
      )}
    </ScreenContainer>
  );
}
