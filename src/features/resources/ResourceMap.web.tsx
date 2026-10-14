import { EmptyState } from '@/components';
import type { ResourceMapProps } from './ResourceMap';

// react-native-maps is iOS/Android only. On web the list stays the usable view;
// this placeholder keeps the toggle honest rather than crashing on a native map.
//
// The props type is imported rather than restated. A hand-copied duplicate had
// already drifted — it made `needCategory` required and never gained `topInset` —
// so the platform the app doesn't ship on was the only one type-checking a
// different contract.
export function ResourceMap(_props: ResourceMapProps) {
  return (
    <EmptyState
      icon="map-outline"
      title="Map isn’t available on web"
      message="Switch back to the list to browse these resources. The map works in the iOS and Android apps."
    />
  );
}
