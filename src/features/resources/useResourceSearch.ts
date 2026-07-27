import { useCallback, useEffect, useState } from 'react';
import { resourceService, type ResourceSearchResult } from '@/services/resources';
import type { Need } from '@/types/need';

/**
 * The shared resource search for the Results screen — one query powering both the
 * list and the map so the two views always agree. Selection (which pin/card is
 * active) is UI state and stays in the screen; this hook owns only the data.
 */
export type ResourceSearchState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; results: ResourceSearchResult[] };

export function useResourceSearch(need: Need): {
  state: ResourceSearchState;
  reload: () => void;
} {
  const [state, setState] = useState<ResourceSearchState>({ status: 'loading' });
  // Bumped by the error state's Retry so the fetch effect re-runs on demand.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    // `active` guards against out-of-order resolution: a need that changes
    // mid-flight must not be overwritten by the previous search's response.
    let active = true;
    setState({ status: 'loading' });
    resourceService
      .search({ need })
      .then((results) => {
        if (active) setState({ status: 'ready', results });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [need, reloadToken]);

  return { state, reload };
}
