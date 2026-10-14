import { StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, pressScale, radii, spacing } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type LocationButtonProps = {
  /** The veteran's ZIP, or undefined if not set yet. */
  zip?: string;
  onPress: () => void;
};

// The location control — the small pill Home, Discover and Map all put in their
// top bar. Shows the ZIP that scopes what help is nearby (set at onboarding,
// always changeable). Tapping opens where it can be edited.
//
// It briefly had a second `title` variant, which rendered the place as the Map
// tab's serif heading back when that screen had no heading of its own. That
// screen now wears the same top bar as every other one, so the variant went with
// it rather than sitting here unused.
export function LocationButton({ zip, onPress }: LocationButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      // Starts with the visible text, so Voice Control's "tap 78701" works. A
      // label sharing no words with what is on screen fails WCAG 2.5.3 and leaves
      // a spoken-input user with nothing to say.
      accessibilityLabel={zip ? `${zip}, tap to change location` : 'Set your location'}
      onPress={onPress}
      scaleTo={pressScale.chip}
      containerStyle={styles.container}
      style={styles.button}
    >
      <Ionicons name="location-outline" size={14} color={colors.accent} />
      <AppText variant="label" color="textSecondary">
        {zip ?? 'Set location'}
      </AppText>
      <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // The pill shrink-wraps its text; without this it would stretch across the top
  // bar. `PressableScale` puts `style` on an inner view, so the sizing of the
  // touchable itself has to be set here.
  container: { alignSelf: 'flex-start' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // A real 44pt target rather than a 26pt pill: `spacing.xs` around an 18pt
    // line box came to 26, well under the floor this codebase states in three
    // other components. The padding gets there on its own (12 + 18 + 12 = 42);
    // `minHeight` is the guarantee, so the target survives a future type change
    // rather than depending on one line box staying 18pt.
    minHeight: 44,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  // No pressed-opacity style: dimming the pill while `PressableScale` also
  // springs it gave this one control two press feels at once, and the spring is
  // the app's single press idiom.
});
