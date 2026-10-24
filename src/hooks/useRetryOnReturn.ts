import { useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';

/**
 * Retry a failed tab once, when the veteran comes back to it.
 *
 * A `focus` listener rather than `useFocusEffect`: the latter re-runs whenever
 * its callback changes while focused, so a foreground failure would retry in a
 * loop. `focus` fires only on a real blur → focus. Inputs ride in refs so the
 * subscription is made once.
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
    const unsubscribe = navigation.addListener('focus', () => {
      if (shouldRetryRef.current) retryRef.current();
    });
    return unsubscribe;
  }, [navigation]);
}
