import { EmptyState, ScreenContainer, ScreenHeader } from '@/components';

export default function ProfileScreen() {
  return (
    <ScreenContainer>
      <ScreenHeader title="Profile" subtitle="Demo mode" />
      <EmptyState
        icon="person-outline"
        title="You are in demo mode"
        message="Watchdog is running with simulated cameras and alerts. Account, privacy, and auto-delete settings will live here."
      />
    </ScreenContainer>
  );
}
