import { EmptyState, ScreenContainer, ScreenHeader } from '@/components';

export default function ReviewScreen() {
  return (
    <ScreenContainer>
      <ScreenHeader title="Review" subtitle="You decide what goes public" />
      <EmptyState
        icon="shield-checkmark-outline"
        title="Nothing to review"
        message="When a camera flags something, it waits here for you to approve or dismiss. Nothing is ever posted without you."
      />
    </ScreenContainer>
  );
}
