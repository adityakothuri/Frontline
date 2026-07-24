import { useCallback, useState } from 'react';
import type { Coordinates } from '@/lib/geo';
import { getCurrentCoordinates, geocodeZip } from './userLocation';

/**
 * `idle` before the veteran asks · `locating` while resolving · `granted` when GPS
 * is on (the map can show the blue dot) · `denied` when permission was refused ·
 * `unavailable` when neither GPS nor a ZIP could resolve a point.
 */
export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

/**
 * Resolves "where is the veteran" on demand for the map's recenter control:
 * device GPS first (with permission), else the profile ZIP. Session-only — no
 * precise location is stored. Permission is requested only when `locate()` runs.
 */
export function useUserLocation(zip?: string): {
  status: LocationStatus;
  locate: () => Promise<Coordinates | null>;
} {
  const [status, setStatus] = useState<LocationStatus>('idle');

  const locate = useCallback(async (): Promise<Coordinates | null> => {
    setStatus('locating');
    const { granted, coords } = await getCurrentCoordinates();

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

  return { status, locate };
}
