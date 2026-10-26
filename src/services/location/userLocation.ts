import * as Location from 'expo-location';
import type { Coordinates } from '@/lib/geo';

/** Thin wrappers over expo-location for the map's "recenter on me". Nothing is persisted. */

/**
 * Request foreground permission and return the device's current coordinates.
 * `granted` reflects the permission answer; `coords` is null when permission was
 * refused or a fix couldn't be obtained (so the caller can fall back to a ZIP).
 */
export async function getCurrentCoordinates(): Promise<{
  granted: boolean;
  coords: Coordinates | null;
}> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { granted: false, coords: null };

  try {
    // Fast path first (last known), then a fresh balanced fix if needed.
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return {
      granted: true,
      coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch {
    return { granted: true, coords: null };
  }
}

/** Geocode a US ZIP to coordinates via the OS geocoder, or null if unresolved. */
export async function geocodeZip(zip: string): Promise<Coordinates | null> {
  try {
    // Bare 5-digit ZIPs are ambiguous to the OS geocoder; qualify with the country.
    const results = await Location.geocodeAsync(`${zip}, USA`);
    const first = results[0];
    return first ? { latitude: first.latitude, longitude: first.longitude } : null;
  } catch {
    return null;
  }
}
