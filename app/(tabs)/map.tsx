import { EmptyState, ScreenContainer, ScreenHeader } from '@/components';

export default function MapScreen() {
  return (
    <ScreenContainer>
      <ScreenHeader
        title="Neighborhood map"
        subtitle="Approved alerts near you"
      />
      <EmptyState
        icon="map-outline"
        title="No nearby alerts"
        message="Approved neighborhood alerts appear here on the map, and clear themselves automatically when they expire."
      />
    </ScreenContainer>
  );
}
