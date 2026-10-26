import { Alert, Linking, Platform } from 'react-native';
import { normaliseWebsiteUrl } from '@/lib/urls';
import type { Resource } from '@/types/resource';

/** Real device actions on a resource — reused by the card and the detail page. */

export async function callPhone(phone: string): Promise<void> {
  const digits = phone.replace(/[^0-9+]/g, '');
  try {
    await Linking.openURL(`tel:${digits}`);
  } catch {
    // No dialer (tablet, simulator): show the number rather than fail silently.
    Alert.alert('Calling isn’t available on this device', `Dial ${phone} from a phone.`);
  }
}

/** Open a website from ingested data. Adds a missing scheme (which
 *  `Linking.openURL` rejects) and reports failure in words. */
export async function openWebsite(url: string): Promise<void> {
  const target = normaliseWebsiteUrl(url);
  if (target === null) return;
  try {
    await Linking.openURL(target);
  } catch {
    Alert.alert('Couldn’t open that link', `Try it in your browser: ${target}`);
  }
}

export async function openDirections(resource: Resource): Promise<void> {
  const query =
    resource.latitude !== null && resource.longitude !== null
      ? `${resource.latitude},${resource.longitude}`
      : resource.address;
  if (!query) return;

  const encoded = encodeURIComponent(query);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${encoded}`,
    android: `geo:0,0?q=${encoded}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  });
  try {
    await Linking.openURL(url ?? `https://www.google.com/maps/search/?api=1&query=${encoded}`);
  } catch {
    // No maps app that answers this scheme — leave the veteran the address.
    Alert.alert('Couldn’t open directions', resource.address ?? query);
  }
}

/** A resource is pinnable only with real coordinates; address-only and referral
 *  rows (national hotlines, county-wide programs) are reached by phone or online. */
export function isOnMap(resource: Resource): boolean {
  return resource.latitude !== null && resource.longitude !== null;
}
