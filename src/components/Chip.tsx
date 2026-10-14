import { Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii, spacing } from '@/theme';
import { AppText } from './AppText';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

// A selectable pill for single/multi-select questions. Selection is shown with
// the accent tint plus a check — never color alone (accessibility).
export function Chip({ label, selected, onPress, icon }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      // Explicit, so the checkmark icon can never be announced ahead of (or
      // instead of) the option text.
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      {selected ? (
        <Ionicons name="checkmark" size={16} color={colors.accent} style={styles.icon} />
      ) : icon ? (
        <Ionicons name={icon} size={16} color={colors.textSecondary} style={styles.icon} />
      ) : null}
      <AppText variant="label" color={selected ? 'textPrimary' : 'textSecondary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44, // >= the 44pt minimum touch target
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
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
  pressed: { opacity: 0.7 },
  icon: { marginRight: spacing.xs },
});
