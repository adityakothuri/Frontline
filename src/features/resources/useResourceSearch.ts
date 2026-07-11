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

  const reload = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const results = await resourceService.search({ need });
      setState({ status: 'ready', results });
    } catch {
      setState({ status: 'error' });
    }
  }, [need]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { state, reload };
}
