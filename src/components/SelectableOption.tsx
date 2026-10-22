import { View, StyleSheet } from 'react-native';
import type Ionicons from '@expo/vector-icons/Ionicons';
import IonIcon from '@expo/vector-icons/Ionicons';
import { colors, pressScale, radii, spacing, withAlpha } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type IconName = keyof typeof Ionicons.glyphMap;

type SelectableOptionProps = {
  label: string;
  description?: string;
  icon?: IconName;
  /** Accent for the leading icon chip; defaults to the olive accent. */
  iconColor?: string;
  selected: boolean;
  /** Multi-select shows a checkbox; single-select shows a radio check. */
  multiple?: boolean;
  onPress: () => void;
};

// A full-width selectable row — the premium option control shared by the setup
// wizard and the profile form. Clear default vs selected states.
export function SelectableOption({
  label,
  description,
  icon,
  iconColor = colors.accent,
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
      style={[styles.row, selected && styles.rowSelected]}
    >
      {icon ? (
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: withAlpha(iconColor, selected ? 0.18 : 0.12) },
          ]}
        >
          <IonIcon name={icon} size={20} color={iconColor} />
        </View>
      ) : null}

      <View style={styles.text}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" color="textMuted">
            {description}
          </AppText>
        ) : null}
      </View>

      <View
        style={[
          styles.indicator,
          multiple ? styles.indicatorBox : styles.indicatorCircle,
          selected && styles.indicatorOn,
        ]}
      >
        {selected ? <IonIcon name="checkmark" size={15} color={colors.textOnAccent} /> : null}
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
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
  indicator: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.transparent,
  },
  indicatorCircle: { borderRadius: radii.pill },
  indicatorBox: { borderRadius: radii.sm },
  indicatorOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
