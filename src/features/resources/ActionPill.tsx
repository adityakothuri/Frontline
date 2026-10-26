import { StyleSheet } from 'react-native';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, radii, spacing } from '@/theme';
import { tapSelection } from '@/lib/haptics';

type ActionPillProps = {
  label: string;
  onPress: () => void;
  /** The one filled button in a cluster — Call, where there is a number to call. */
  primary?: boolean;
  /** Tinted: an action currently in effect (Saved) or one that is itself AI
   *  (Call script). */
  active?: boolean;
  /** Set for a toggle, so its state is announced rather than inferred. */
  selected?: boolean;
};

/**
 * The square text button used by the map preview and Ask's welcome. The detail
 * page has its own icon-tile bar. Olive throughout: olive owns every action.
 */
export function ActionPill({
  label,
  onPress,
  primary = false,
  active = false,
  selected,
}: ActionPillProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={() => {
        tapSelection();
        onPress();
      }}
      scaleTo={pressScale.chip}
      style={[styles.button, primary && styles.primary, active && styles.active]}
    >
      <AppText variant="data" color={primary ? 'textOnAccent' : 'accent'}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  primary: { backgroundColor: colors.accent },
  active: { backgroundColor: colors.accentSoft },
});
