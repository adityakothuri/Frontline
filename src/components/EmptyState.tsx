import { View, StyleSheet } from 'react-native';
import { spacing } from '@/theme';
import { AppText } from './AppText';
import { TextAction } from './TextAction';

type EmptyStateProps = {
  /** Short mono line naming the state: "NOTHING SAVED YET". */
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

// Left-aligned and plain: what is empty, why, and one thing to do about it.
export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <AppText variant="kicker" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary">
        {message}
      </AppText>
      {actionLabel && onAction ? <TextAction label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No rule of its own: it sits under a masthead that already has one.
  root: { gap: spacing.sm, paddingTop: spacing.sm },
});
