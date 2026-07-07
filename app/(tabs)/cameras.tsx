import { EmptyState, ScreenContainer, ScreenHeader } from '@/components';

export default function CamerasScreen() {
  return (
    <ScreenContainer>
      <ScreenHeader title="Cameras" subtitle="Live status and recent events" />
      <EmptyState
        icon="videocam-outline"
        title="No cameras connected"
        message="Connect a device or start a simulated camera to preview its live status and recent events here."
      />
    </ScreenContainer>
  );
}
