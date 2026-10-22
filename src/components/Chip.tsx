import { StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, pressScale, radii, spacing } from '@/theme';
import { tapSelection } from '@/lib/haptics';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type ChipProps = {
  label: string;
  /** Omit for a one-shot chip (a starter prompt, a follow-up) that sends rather
   *  than toggles — it then carries no selected state for a screen reader. */
  selected?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

// A selectable pill for single/multi-select questions. Selection is shown with
// the accent tint plus a check — never color alone (accessibility). Presses go
// through `PressableScale` like every other control: this was one of the last
// plain `Pressable`s dimming itself to 0.7, a second press feel in an app that
// is supposed to have one.
export function Chip({ label, selected, onPress, icon }: ChipProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      // Explicit, so the checkmark icon can never be announced ahead of (or
      // instead of) the option text.
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={() => {
        tapSelection();
        onPress();
      }}
      scaleTo={pressScale.chip}
      style={[styles.base, selected ? styles.selected : styles.unselected]}
    >
      {selected ? (
        <Ionicons name="checkmark" size={16} color={colors.accent} style={styles.icon} />
      ) : icon ? (
        <Ionicons name={icon} size={16} color={colors.textSecondary} style={styles.icon} />
      ) : null}
      <AppText variant="label" color={selected ? 'textPrimary' : 'textSecondary'}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44, // >= the 44pt minimum touch target
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unselected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  icon: { marginRight: spacing.xs },
});
