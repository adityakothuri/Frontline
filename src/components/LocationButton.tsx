import { Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii, spacing } from '@/theme';
import { AppText } from './AppText';

type LocationButtonProps = {
  /** The veteran's ZIP, or undefined if not set yet. */
  zip?: string;
  onPress: () => void;
};

// The top-left location control. Shows the ZIP that scopes what help is nearby
// (set at onboarding, always changeable). Tapping opens where it can be edited.
export function LocationButton({ zip, onPress }: LocationButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={zip ? `Location ${zip}, tap to change` : 'Set your location'}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="location-outline" size={14} color={colors.accent} />
      <AppText variant="label" color="textSecondary">
        {zip ?? 'Set location'}
      </AppText>
      <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
});
