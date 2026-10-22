import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, radii, spacing } from '@/theme';
import { tapImpact } from '@/lib/haptics';
import { DangerCallBanner } from './EmergencyCallBanner';
import { callPhone } from './resourceActions';

// Category-level crisis routing shown at the top of the Emergency results page:
// point straight to the real crisis lines before any list of resources.
// Distinct from EmergencyCallBanner, which is per-resource contact on a detail
// page. 911 stays text-only on purpose — a mis-tap must never place an
// emergency call.
//
// `compact` is the Home variant: one quiet row, always present, so the single
// most important number in a veteran's life is never more than one tap from the
// front door. It is deliberately not the full banner — on Home nothing has gone
// wrong, so it speaks in the surface register of the cards around it, with the
// danger hue confined to the glyph. Red is reserved for genuine emergencies, and
// this is one; it is just not shouting.
//
// The whole row dials, on purpose. The mis-tap rule above is about 911, where a
// stray call costs a dispatcher; here iOS asks "Call 988?" before connecting and
// Android opens the dialer pre-filled without dialling, so a mis-tap costs a
// cancel. The trailing word says what the tap does — a chevron implied a page.
export function CrisisBanner({
  style,
  compact = false,
}: {
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const call = () => {
    tapImpact();
    callPhone('988');
  };

  if (compact) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Veterans Crisis Line. Call 988, then press 1. Free, confidential, any hour."
        onPress={call}
        scaleTo={pressScale.subtle}
        style={[styles.row, style]}
      >
        <View style={styles.glyph}>
          <Ionicons name="call" size={16} color={colors.danger} />
        </View>
        <View style={styles.copy}>
          <AppText variant="bodyStrong">Veterans Crisis Line</AppText>
          <AppText variant="caption" color="textSecondary">
            Dial 988, then press 1 · free, confidential, any hour
          </AppText>
        </View>
        <AppText variant="label" style={styles.callWord}>
          Call
        </AppText>
      </PressableScale>
    );
  }

  return (
    <DangerCallBanner
      style={style}
      title="If you're in immediate danger, call 911"
      message="The Veterans Crisis Line is free, confidential, and available 24/7."
      callLabel="Call 988, then press 1"
      accessibilityLabel="Call 988, then press 1, for the Veterans Crisis Line"
      onCall={call}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  glyph: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
  },
  copy: { flex: 1, gap: spacing.xxs },
  // `dangerText`, the text-grade red: 4.5:1 on paper where `danger` is not.
  callWord: { color: colors.dangerText },
});
