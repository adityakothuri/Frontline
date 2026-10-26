import { StyleSheet } from 'react-native';
import { colors, pressScale, radii, spacing } from '@/theme';
import { tapSelection } from '@/lib/haptics';
import { AppText } from './AppText';
import { Glyph } from './Glyph';
import { PressableScale } from './PressableScale';

type ChipProps = {
  label: string;
  /** Omit for a one-shot chip (a starter prompt, a follow-up) that sends rather
   *  than toggles — it then carries no selected state for a screen reader. */
  selected?: boolean;
  onPress: () => void;
};

// A square option tag. Selected is solid ink with a check, so the state never
// rests on colour alone.
export function Chip({ label, selected, onPress }: ChipProps) {
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
      style={[styles.base, selected && styles.selected]}
    >
      {selected ? <Glyph name="check" size={14} color={colors.surface} /> : null}
      <AppText variant="label" color={selected ? 'surface' : 'textPrimary'}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
  selected: { backgroundColor: colors.textPrimary },
});
