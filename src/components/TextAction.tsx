import { StyleSheet } from 'react-native';
import { pressScale } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

/** A caps text action ending in ▸ — the secondary action idiom. */
export function TextAction({
  label,
  onPress,
  tone = 'accent',
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'textPrimary';
  accessibilityHint?: string;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      scaleTo={pressScale.chip}
      onPress={onPress}
      containerStyle={styles.actionContainer}
      style={styles.action}
    >
      <AppText variant="data" color={tone}>
        {`${label} ▸`}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  actionContainer: { alignSelf: 'flex-start' },
  // The text line is 18pt; the row is padded to a 44pt target.
  action: { minHeight: 44, justifyContent: 'center' },
});
