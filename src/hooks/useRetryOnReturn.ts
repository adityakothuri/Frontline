import { useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';

/**
 * Retry a failed tab once, when the veteran *comes back* to it.
 *
 * Coming back to a failed tab is a retry in everything but name — they have
 * usually been off fixing their signal — so doing it for them saves a tap on the
 * one screen where they have already been let down once.
 *
 * Why this is a navigation listener and not `useFocusEffect`. Discover and Map
 * both used to do this with
 * `useFocusEffect(useCallback(() => { if (status === 'error') reload(); }, [status]))`,
 * and that loops: `useFocusEffect` re-runs its callback whenever the callback's
 * identity changes *while the screen is focused*. A fetch failing in the
 * foreground flips `status` to `'error'`, the callback changes, it runs,
 * `reload()` wipes the resource cache and refetches, that fails too, and round it
 * goes every ~1.6s — with the loading gate dropping its shield on each failure and
 * raising it again on each reload, so the veteran saw a mark that pulsed forever
 * and never an error state. The `focus` event below fires only on a real
 * blur → focus transition, which is the one moment this behaviour was ever meant
 * to cover.
 *
 * The inputs ride in refs so the subscription is made once per screen and reads
 * the latest values when the event actually fires.
 */
export function useRetryOnReturn(shouldRetry: boolean, retry: () => void): void {
  const navigation = useNavigation();
  const shouldRetryRef = useRef(shouldRetry);
  const retryRef = useRef(retry);

  useEffect(() => {
    shouldRetryRef.current = shouldRetry;
    retryRef.current = retry;
  }, [shouldRetry, retry]);

  useEffect(() => {
    // A navigator with no parent emits `focus` for its initial screen too, when
    // nothing has failed yet; the guard inside is what keeps this to genuine
    // returns either way.
    const unsubscribe = navigation.addListener('focus', () => {
      if (shouldRetryRef.current) retryRef.current();
    });
    return unsubscribe;
  }, [navigation]);
}
