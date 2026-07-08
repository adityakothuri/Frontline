import { EmptyState, ScreenContainer, ScreenHeader } from '@/components';

export default function SavedScreen() {
  return (
    <ScreenContainer>
      <ScreenHeader title="Saved" subtitle="Your resources, in one place" />
      <EmptyState
        icon="bookmark-outline"
        title="Nothing saved yet"
        message="Resources, benefits, call scripts, and document checklists you save will show up here so you can come back to them."
      />
    </ScreenContainer>
  );
}
