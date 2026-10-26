import { StyleSheet } from 'react-native';
import { pressScale, spacing } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type LocationButtonProps = {
  /** The veteran's ZIP, or undefined if not set yet. */
  zip?: string;
  onPress: () => void;
};

// The ZIP that scopes what is shown, as a mono line above a masthead title.
export function LocationButton({ zip, onPress }: LocationButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      // Starts with the visible text so Voice Control's "tap ZIP 78701" works.
      accessibilityLabel={zip ? `ZIP ${zip}, change location` : 'Set your location'}
      onPress={onPress}
      scaleTo={pressScale.chip}
      containerStyle={styles.container}
      style={styles.button}
    >
      <AppText variant="data" color="accent">
        {zip ? `ZIP ${zip} ▸` : 'SET LOCATION ▸'}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-start' },
  // The text line is 18pt; vertical padding brings the target to 44.
  button: { minHeight: 44, justifyContent: 'center', paddingVertical: spacing.md },
});
