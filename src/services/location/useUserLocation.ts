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
 * Resolves "where is the veteran" for the map: on demand for the recenter
 * control, and — once permission is known to be granted — as a live coordinate
 * for the user puck. Session-only: no precise location is ever stored.
 *
 * The watch deliberately cannot start on its own. It begins only after `locate()`
 * has returned `granted`, which is the one moment the veteran actually asked to
 * be found, so this adds **no new permission prompt and no background GPS** to a
 * product whose whole location story is "a ZIP is enough". `watch` on top of that
 * lets the caller stop it while its screen is off-camera.
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
  // Sticky, and deliberately not derived from `status`.
  //
  // `status` is a *transient* — tapping recenter flips it to `'locating'` and
  // back. Keying the watch on `status === 'granted'` therefore tore the
  // subscription down and rebuilt it on every recenter tap, blanking the puck
  // mid-gesture and opening a second GPS session to replace the one that had
  // just been closed. Permission, once given, does not flicker; this records
  // that rather than the request in flight.
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
      // Drop the last fix rather than leaving a stale puck sitting on the map
      // reporting a position we are no longer tracking.
      setCoordinates(null);
      return;
    }

    // `active` covers the gap between this effect being torn down and the
    // subscription promise resolving: without it a fast tab switch leaves an
    // orphaned watch running with no one left to remove it.
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    Location.watchPositionAsync(
      // Balanced, not BestForNavigation: this is a dot on an overview map, not
      // turn-by-turn, and the highest accuracy tier is the expensive one. 25m is
      // under a city block — finer than the puck can even draw at these zooms.
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
        // A watch that won't start is not worth surfacing: the recenter button
        // still works, and the puck is an enhancement over the map, not the map.
      });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [watch, everGranted]);

  return { status, locate, coordinates };
}
