import { useCallback, useEffect, useState } from 'react';
import {
  invalidateResourceCache,
  resourceService,
  type ResourceSearchResult,
} from '@/services/resources';
import { reportDataError } from '@/services/monitoring';
import type { Need } from '@/types/need';

/**
 * The shared resource search for the Results screen — one query powering both the
 * list and the map so the two views always agree. Selection (which pin/card is
 * active) is UI state and stays in the screen; this hook owns only the data.
 */
/**
 * The load state of a resource query. Shared with the Discover and Map tabs,
 * which run their own browse queries but need exactly this shape.
 *
 * `stale` rides along on both non-ready states, carrying the last successful
 * results forward. That is what lets a failed refresh show a banner over a
 * working list instead of replacing nearby help with an apology — and carrying
 * it through `loading` too is what makes it survive the refetch in between.
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
 * @param enabled Whether the need is settled enough to search on. Results passes
 *   the profile's hydration state: searching on a not-yet-hydrated profile means
 *   searching with no ZIP, which finds nothing local and then refetches anyway.
 *   A disabled search stays in `loading`, which is what the wait actually is.
 */
export function useResourceSearch(
  need: Need,
  enabled = true,
): {
  state: ResourceSearchState;
  reload: () => void;
} {
  const [state, setState] = useState<ResourceSearchState>({ status: 'loading', stale: [] });
  // Bumped by the error state's Retry so the fetch effect re-runs on demand.
  const [reloadToken, setReloadToken] = useState(0);
  // "Try again" has to mean a real attempt, so it clears the cache first — a
  // cached result would make the button look like it did nothing.
  const reload = useCallback(() => {
    invalidateResourceCache();
    setReloadToken((n) => n + 1);
  }, []);

  // Drop the fallback when the need itself changes — housing results are not a
  // stale view of food, they're the wrong answer. Declared before the fetch
  // effect so it runs first, and the fetch below then carries an empty `stale`.
  // A plain retry (reloadToken only) doesn't re-run this, so the fallback holds.
  useEffect(() => {
    setState({ status: 'loading', stale: [] });
  }, [need]);

  useEffect(() => {
    if (!enabled) return;
    // `active` guards against out-of-order resolution: a need that changes
    // mid-flight must not be overwritten by the previous search's response.
    let active = true;
    // The updater form is what carries `stale` across the refetch — the results
    // on screen when a refresh starts are the ones worth falling back on.
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
