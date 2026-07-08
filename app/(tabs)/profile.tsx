import { EmptyState, ScreenContainer, ScreenHeader } from '@/components';

export default function ProfileScreen() {
  return (
    <ScreenContainer>
      <ScreenHeader title="Profile" subtitle="Optional — never required" />
      <EmptyState
        icon="person-outline"
        title="Your preferences will live here"
        message="Soon you'll be able to set your ZIP, search radius, and which documents you have — all optional, to personalize results. Frontline never asks for sensitive information."
      />
    </ScreenContainer>
  );
}
