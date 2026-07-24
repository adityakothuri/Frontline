import { EmptyState } from '@/components';
import type { ResourceSearchResult } from '@/services/resources';
import type { NeedCategory } from '@/types/need';

type ResourceMapProps = {
  results: ResourceSearchResult[];
  needCategory: NeedCategory;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

// react-native-maps is iOS/Android only. On web the list stays the usable view;
// this placeholder keeps the toggle honest rather than crashing on a native map.
export function ResourceMap(_props: ResourceMapProps) {
  return (
    <EmptyState
      icon="map-outline"
      title="Map isn’t available on web"
      message="Switch back to the list to browse these resources. The map works in the iOS and Android apps."
    />
  );
}
