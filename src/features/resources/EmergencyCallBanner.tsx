import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppText, Glyph, PressableScale } from '@/components';
import { colors, radii, spacing } from '@/theme';
import type { Resource } from '@/types/resource';

type DangerCallBannerProps = {
  title: string;
  message: string;
  callLabel: string;
  accessibilityLabel: string;
  onCall: () => void;
  style?: StyleProp<ViewStyle>;
};

// The shared danger-tinted banner shell (title, context, call button) wrapped by
// EmergencyCallBanner and CrisisBanner.
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
      <AppText variant="kicker" color="dangerText">
        Emergency
      </AppText>
      <AppText variant="heading" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary">
        {message}
      </AppText>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onCall}
      >
        {({ pressed }) => (
          <View style={[styles.callButton, pressed && styles.callButtonPressed]}>
            <Glyph name="call" size={18} color={colors.background} />
            <AppText variant="label" style={styles.callLabel}>
              {callLabel}
            </AppText>
          </View>
        )}
      </PressableScale>
    </View>
  );
}

type EmergencyCallBannerProps = {
  resource: Resource;
  onCall: () => void;
};

// Contact-only urgent action at the top of an emergency resource; no triage or advice.
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
    backgroundColor: colors.dangerSoft,
    borderWidth: 2,
    borderColor: colors.danger,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { color: colors.dangerText },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.danger,
    marginTop: spacing.xs,
  },
  // Darkens on press rather than dimming, so it never looks disabled.
  callButtonPressed: { backgroundColor: colors.dangerText },
  callLabel: {
    color: colors.background,
    fontSize: 15,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
