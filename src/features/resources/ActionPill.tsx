import { StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, radii, spacing } from '@/theme';

type ActionPillProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** The one filled pill in a cluster — Call, where there is a number to call. */
  primary?: boolean;
  /** Olive-tinted rather than plain: an action that is currently in effect
   *  (Saved) or that is itself AI (Call script). */
  active?: boolean;
  /** Set for a toggle, so its state is announced rather than left to be inferred
   *  from a glyph swap. Omit for a plain action. */
  selected?: boolean;
};

/**
 * The one pill button for acting on a resource.
 *
 * Lives here rather than inside a screen because a resource is met in three
 * places — the detail page's `ActionRow`, the map's `ResourcePreview`, and
 * whatever comes next — and "Call" has to look and feel identical in all of them.
 * It used to exist twice, once per consumer, which is how the two drifted to
 * different press scales.
 *
 * Olive throughout: these are actions, and olive owns every action in this app.
 * Category hues never appear here.
 */
export function ActionPill({
  icon,
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
      onPress={onPress}
      scaleTo={pressScale.chip}
      style={[styles.pill, primary && styles.pillPrimary, active && styles.pillActive]}
    >
      <Ionicons name={icon} size={16} color={primary ? colors.textOnAccent : colors.accent} />
      <AppText variant="label" color={primary ? 'textOnAccent' : 'accentPressed'}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // A real 44pt target, the minimum every other control in the app meets.
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pillPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
});
