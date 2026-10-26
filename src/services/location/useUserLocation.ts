import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinates } from '@/lib/geo';
import { getCurrentCoordinates, geocodeZip } from './userLocation';

/**
 * `idle` before the veteran asks · `locating` while resolving · `granted` when GPS
 * is on (the map can show the puck) · `denied` when permission was refused ·
 * `unavailable` when neither GPS nor a ZIP could resolve a point.
 */
export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

/**
 * Resolves "where is the veteran" for the map: on demand for recenter, and as a
 * live coordinate for the puck. Session-only; nothing is stored. The watch starts
 * only after `locate()` was granted, so it adds no permission prompt and no
 * background GPS; `watch` lets the caller pause it off-screen.
 */
export function useUserLocation(
  zip?: string,
  watch = false,
): {
  status: LocationStatus;
  locate: () => Promise<Coordinates | null>;
  /** The live device position, or null until permission is granted and a fix
   *  lands. Never persisted, and cleared when the watch stops. */
  coordinates: Coordinates | null;
} {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  // Sticky, not derived from `status`, which flips through 'locating' on every
  // recenter tap and would tear the watch down each time.
  const [everGranted, setEverGranted] = useState(false);

  const locate = useCallback(async (): Promise<Coordinates | null> => {
    setStatus('locating');
    const { granted, coords } = await getCurrentCoordinates();

    if (granted) setEverGranted(true);

    if (granted && coords) {
      setStatus('granted');
      return coords;
    }

    // GPS refused or no fix — fall back to the ZIP if we have one.
    if (zip) {
      const zipCoords = await geocodeZip(zip);
      if (zipCoords) {
        setStatus(granted ? 'granted' : 'denied');
        return zipCoords;
      }
    }

    setStatus(granted ? 'unavailable' : 'denied');
    return null;
  }, [zip]);

  useEffect(() => {
    if (!watch || !everGranted) {
      // No stale puck for a position we no longer track.
      setCoordinates(null);
      return;
    }

    // Covers teardown before the subscription resolves, which would orphan the watch.
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    Location.watchPositionAsync(
      // A dot on an overview map: balanced accuracy, 25m steps.
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 25 },
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
    )
      .then((sub) => {
        if (active) subscription = sub;
        else sub.remove();
      })
      .catch(() => {
        // The puck is an enhancement; recenter still works without it.
      });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [watch, everGranted]);

  return { status, locate, coordinates };
}
