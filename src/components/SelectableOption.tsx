import { View, StyleSheet } from 'react-native';
import { colors, pressScale, radii, spacing } from '@/theme';
import { AppText } from './AppText';
import { Glyph } from './Glyph';
import { PressableScale } from './PressableScale';

type SelectableOptionProps = {
  label: string;
  description?: string;
  selected: boolean;
  /** Multi-select shows a checkbox; single-select shows a filled square. */
  multiple?: boolean;
  onPress: () => void;
};

// A full-width ruled row with a square mark on the right, like a printed form.
export function SelectableOption({
  label,
  description,
  selected,
  multiple = false,
  onPress,
}: SelectableOptionProps) {
  return (
    <PressableScale
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={pressScale.subtle}
      style={styles.row}
    >
      <View style={styles.text}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" color="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.box, selected && styles.boxOn]}>
        {selected && multiple ? <Glyph name="check" size={16} color={colors.surface} /> : null}
        {selected && !multiple ? <View style={styles.dot} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  text: { flex: 1, gap: spacing.xxs },
  box: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
  boxOn: { backgroundColor: colors.textPrimary },
  dot: { width: 10, height: 10, backgroundColor: colors.surface },
});
