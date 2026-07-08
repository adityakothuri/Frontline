import { Linking, Platform } from 'react-native';
import type { Resource } from '@/types/resource';

/** Real device actions on a resource — reused by the card and the detail page. */

export async function callPhone(phone: string): Promise<void> {
  const digits = phone.replace(/[^0-9+]/g, '');
  await Linking.openURL(`tel:${digits}`);
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
