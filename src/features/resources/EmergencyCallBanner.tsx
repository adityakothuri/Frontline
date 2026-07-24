import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components';
import { colors, radii, spacing, withAlpha } from '@/theme';
import type { Resource } from '@/types/resource';

type DangerCallBannerProps = {
  title: string;
  message: string;
  callLabel: string;
  accessibilityLabel: string;
  onCall: () => void;
  style?: StyleProp<ViewStyle>;
};

// The one danger-tinted banner shell: alert title, one line of context, one
// big call button. EmergencyCallBanner (per-resource, detail page) and
// CrisisBanner (category-level, Emergency results) both wrap it so the
// treatment can't drift.
export function DangerCallBanner({
  title,
  message,
  callLabel,
  accessibilityLabel,
  onCall,
  style,
}: DangerCallBannerProps) {
  return (
    <View style={[styles.banner, style]}>
      <View style={styles.headerRow}>
        <Ionicons name="alert-circle" size={20} color={colors.danger} />
        <AppText variant="subtitle" style={styles.title}>
          {title}
        </AppText>
      </View>
      <AppText variant="body" color="textSecondary">
        {message}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onCall}
        style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
      >
        <Ionicons name="call" size={18} color={colors.background} />
        <AppText variant="subtitle" style={styles.callLabel}>
          {callLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

type EmergencyCallBannerProps = {
  resource: Resource;
  onCall: () => void;
};

// A prominent, contact-only urgent action shown at the top of an emergency
// resource. It only helps the veteran reach the resource fast — it gives no
// triage or advice.
export function EmergencyCallBanner({ resource, onCall }: EmergencyCallBannerProps) {
  if (!resource.phone) return null;
  return (
    <DangerCallBanner
      title="Need help right now?"
      message={`You can reach ${resource.name} directly — you don’t have to wait.`}
      callLabel={`Call ${resource.phone}`}
      accessibilityLabel={`Call ${resource.phone}`}
      onCall={onCall}
    />
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: withAlpha(colors.danger, 0.1),
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(colors.danger, 0.4),
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { color: colors.dangerText, flexShrink: 1 },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.danger,
    marginTop: spacing.xs,
  },
  callButtonPressed: { opacity: 0.85 },
  callLabel: { color: colors.background },
});
