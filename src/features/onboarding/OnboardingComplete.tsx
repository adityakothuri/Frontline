import { useEffect, useState } from 'react';
import { View, Pressable, Animated, Easing, AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PrimaryButton } from '@/components';
import { colors, radii, spacing, withAlpha } from '@/theme';
import { VETERAN_ROLE_LABELS, type VeteranRole } from '@/types/profile';
import type { VeteranDocument } from '@/types/need';

type Draft = {
  firstName: string;
  zip: string;
  role?: VeteranRole;
  documentsOnHand: VeteranDocument[];
  preferredRadiusMiles?: number;
};

type OnboardingCompleteProps = {
  draft: Draft;
  onBack: () => void;
  onCreate: () => void;
  loading: boolean;
};

// The finale of setup: a warm confirmation + a recap, then "Create account" —
// which saves the profile on-device. The celebratory moment of the flow.
export function OnboardingComplete({ draft, onBack, onCreate, loading }: OnboardingCompleteProps) {
  const [pop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      if (reduce) {
        pop.setValue(1);
      } else {
        Animated.timing(pop, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
    return () => {
      active = false;
    };
  }, [pop]);

  const checkStyle = {
    opacity: pop,
    transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
  };

  const recap: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'location-outline', text: draft.zip },
    ...(draft.role ? [{ icon: 'ribbon-outline' as const, text: VETERAN_ROLE_LABELS[draft.role] }] : []),
    ...(draft.documentsOnHand.length
      ? [
          {
            icon: 'documents-outline' as const,
            text: `${draft.documentsOnHand.length} document${draft.documentsOnHand.length > 1 ? 's' : ''}`,
          },
        ]
      : []),
    ...(draft.preferredRadiusMiles
      ? [{ icon: 'navigate-outline' as const, text: `${draft.preferredRadiusMiles} mi` }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Animated.View style={[styles.check, checkStyle]}>
          <Ionicons name="checkmark" size={44} color={colors.success} />
        </Animated.View>

        <AppText variant="displayLarge" style={styles.title}>
          You&apos;re ready, {draft.firstName.trim()}.
        </AppText>
        <AppText variant="body" color="textSecondary" style={styles.subtitle}>
          Here&apos;s your setup — create your account to save it and get your personalized help.
        </AppText>

        <View style={styles.recap}>
          {recap.map((r) => (
            <View key={r.text} style={styles.recapChip}>
              <Ionicons name={r.icon} size={13} color={colors.accent} />
              <AppText variant="label" color="textSecondary">
                {r.text}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="Create account" onPress={onCreate} loading={loading} />
        <View style={styles.reassure}>
          <Ionicons name="phone-portrait-outline" size={13} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted">
            Saved on this device · no sign-in
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, height: 40, justifyContent: 'center' },
  backBtn: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  check: {
    width: 92,
    height: 92,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.success, 0.14),
    marginBottom: spacing.xl,
  },
  title: { textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { textAlign: 'center', maxWidth: 330, marginBottom: spacing.xl },
  recap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  recapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  footer: { paddingHorizontal: spacing.xl, gap: spacing.md },
  reassure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  pressed: { opacity: 0.6 },
});
