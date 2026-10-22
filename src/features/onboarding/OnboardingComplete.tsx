import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale, PrimaryButton, ShieldTrace } from '@/components';
import { colors, pressScale, radii, rise, spacing, stagger, timings } from '@/theme';
import { tapImpact } from '@/lib/haptics';
import { riseIn, stepDelay } from '@/theme/motionPresets';
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

// The finale of setup: a warm confirmation + a recap, then "Finish setup" —
// which saves the profile on-device. The celebratory moment of the flow. It
// used to say "Create account", which was false in two directions: there is no
// account, and the line underneath promised "no sign-in".
export function OnboardingComplete({ draft, onBack, onCreate, loading }: OnboardingCompleteProps) {
  // The one genuine milestone in the app, so it gets the one genuine
  // celebration: the shield traces its outline once, then the star draws, blooms
  // and bursts — and `hold` keeps the finished mark on screen instead of fading
  // it down, because here the mark is the destination rather than a handover.
  // This replaces a generic check-in-a-circle, so the page gains a moment and
  // loses a piece of furniture.
  const [markDone, setMarkDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMarkDone(true), timings.introHold);
    return () => clearTimeout(timer);
  }, []);

  const recap: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'location-outline', text: draft.zip },
    ...(draft.role
      ? [{ icon: 'ribbon-outline' as const, text: VETERAN_ROLE_LABELS[draft.role] }]
      : []),
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
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          scaleTo={pressScale.control}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </PressableScale>
      </View>

      <View style={styles.body}>
        <View
          style={styles.mark}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Setup complete"
        >
          <ShieldTrace size={92} color={colors.success} done={markDone} hold />
        </View>

        <Animated.View entering={riseIn(stagger.step)}>
          <AppText variant="displayLarge" style={styles.title}>
            You&apos;re ready, {draft.firstName.trim()}.
          </AppText>
        </Animated.View>
        <Animated.View entering={riseIn(stagger.step * 2)}>
          <AppText variant="body" color="textSecondary" style={styles.subtitle}>
            Here&apos;s what you told us. Finish setup and we&apos;ll start finding help near{' '}
            {draft.zip}.
          </AppText>
        </Animated.View>

        <View style={styles.recap}>
          {recap.map((r, i) => (
            <Animated.View
              key={r.icon}
              entering={riseIn(stepDelay(i + 3))}
              style={styles.recapChip}
            >
              <Ionicons name={r.icon} size={13} color={colors.accent} />
              <AppText variant="label" color="textSecondary">
                {r.text}
              </AppText>
            </Animated.View>
          ))}
        </View>
      </View>

      <Animated.View entering={riseIn(stagger.max, rise.md)} style={styles.footer}>
        <PrimaryButton
          label="Finish setup"
          onPress={() => {
            tapImpact();
            onCreate();
          }}
          loading={loading}
        />
        <View style={styles.reassure}>
          <Ionicons name="phone-portrait-outline" size={13} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted">
            Saved on this device · no sign-in
          </AppText>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    height: 40,
    justifyContent: 'center',
  },
  backBtn: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  // No tinted disc behind the mark: the shield draws its own silhouette, and a
  // circle behind it would be the rounded icon tile the design rules ban.
  mark: { marginBottom: spacing.xl },
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
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md },
  reassure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
