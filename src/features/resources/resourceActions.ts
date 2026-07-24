import { Alert, Linking, Platform } from 'react-native';
import type { Resource } from '@/types/resource';

/** Real device actions on a resource — reused by the card and the detail page. */

export async function callPhone(phone: string): Promise<void> {
  const digits = phone.replace(/[^0-9+]/g, '');
  try {
    await Linking.openURL(`tel:${digits}`);
  } catch {
    // No dialer here (tablet, simulator, web) — show the number instead of
    // failing silently; on a crisis line that silence would be the worst UX.
    Alert.alert('Calling isn’t available on this device', `Dial ${phone} from a phone.`);
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
  await Linking.openURL(url ?? `https://www.google.com/maps/search/?api=1&query=${encoded}`);
}
