import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, spacing } from '@/theme';
import { tapImpact } from '@/lib/haptics';
import { DangerCallBanner } from './EmergencyCallBanner';
import { callPhone } from './resourceActions';

// Crisis routing at the top of Emergency results, before any list (distinct
// from EmergencyCallBanner, per resource). 911 is text-only so a mis-tap never
// places an emergency call.
//
// `compact` is the always-present Home row: red confined to frame and call
// word. The whole row dials 988, which is safe — iOS confirms and Android only
// pre-fills the dialer.
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
        <View style={styles.copy}>
          <AppText variant="bodyStrong">Veterans Crisis Line</AppText>
          <AppText variant="caption" color="textSecondary">
            Dial 988, then press 1 · free, confidential, any hour
          </AppText>
        </View>
        <AppText variant="data" color="dangerText">
          Call ▸
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  copy: { flex: 1, gap: spacing.xxs },
});
