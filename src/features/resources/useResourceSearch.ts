import { useCallback, useEffect, useState } from 'react';
import { resourceService, type ResourceSearchResult } from '@/services/resources';
import { reportDataError } from '@/services/monitoring';
import type { Need } from '@/types/need';

/**
 * Load state of a resource query (also used by Discover and Map). `stale` keeps
 * the last good results through loading and error, so a failed refresh shows a
 * banner over a working list.
 */
export type ResourceSearchState =
  | { status: 'loading'; stale: ResourceSearchResult[] }
  | { status: 'error'; error: unknown; stale: ResourceSearchResult[] }
  | { status: 'ready'; results: ResourceSearchResult[] };

/** The results a screen should be showing: fresh ones, or the last good set. */
export function resultsOf(state: ResourceSearchState): ResourceSearchResult[] {
  return state.status === 'ready' ? state.results : state.stale;
}

/**
 * The Results screen's search: one query for both list and map, so they agree.
 * @param enabled False until the profile hydrates (no ZIP yet); stays `loading`.
 */
export function useResourceSearch(
  need: Need,
  enabled = true,
): {
  state: ResourceSearchState;
  reload: () => void;
} {
  const [state, setState] = useState<ResourceSearchState>({ status: 'loading', stale: [] });
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  // A new need drops the fallback: another need's results are wrong, not stale.
  // Must be declared before the fetch effect so it runs first.
  useEffect(() => {
    setState({ status: 'loading', stale: [] });
  }, [need]);

  useEffect(() => {
    if (!enabled) return;
    // Guards against an earlier search resolving after a later one.
    let active = true;
    // Updater form carries the on-screen results forward as `stale`.
    setState((prev) => ({ status: 'loading', stale: resultsOf(prev) }));
    resourceService
      .search({ need })
      .then((results) => {
        if (active) setState({ status: 'ready', results });
      })
      .catch((error) => {
        reportDataError('Results search', error);
        if (active) setState((prev) => ({ status: 'error', error, stale: resultsOf(prev) }));
      });
    return () => {
      active = false;
    };
  }, [need, reloadToken, enabled]);

  return { state, reload };
}
