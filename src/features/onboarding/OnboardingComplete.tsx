import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, DataRow, Glyph, PressableScale, PrimaryButton, ShieldTrace } from '@/components';
import { colors, pressScale, rise, spacing, stagger, timings } from '@/theme';
import { tapImpact } from '@/lib/haptics';
import { riseIn } from '@/theme/motionPresets';
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

// The end of setup: a confirmation and recap, then "Finish setup", which saves
// the profile on-device (there is no account).
export function OnboardingComplete({ draft, onBack, onCreate, loading }: OnboardingCompleteProps) {
  // The app's one celebration: the shield finale, with `hold` keeping the
  // finished mark on screen.
  const [markDone, setMarkDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMarkDone(true), timings.introHold);
    return () => clearTimeout(timer);
  }, []);

  const recap: { label: string; value: string }[] = [
    { label: 'ZIP code', value: draft.zip },
    ...(draft.role ? [{ label: 'Role', value: VETERAN_ROLE_LABELS[draft.role] }] : []),
    ...(draft.documentsOnHand.length
      ? [
          {
            label: 'Documents',
            value: `${draft.documentsOnHand.length} document${draft.documentsOnHand.length > 1 ? 's' : ''}`,
          },
        ]
      : []),
    ...(draft.preferredRadiusMiles
      ? [{ label: 'Radius', value: `${draft.preferredRadiusMiles} miles` }]
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
          <Glyph name="back" size={22} />
        </PressableScale>
      </View>

      <View style={styles.body}>
        <View
          style={styles.mark}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Setup complete"
        >
          <ShieldTrace size={72} color={colors.textPrimary} done={markDone} hold />
        </View>

        <Animated.View entering={riseIn(stagger.step)}>
          <AppText variant="display" style={styles.title} accessibilityRole="header">
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
            <DataRow key={r.label} label={r.label} value={r.value} last={i === recap.length - 1} />
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
        <AppText variant="kicker" color="textSecondary" style={styles.reassure}>
          Saved on this device · no sign-in
        </AppText>
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
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  // No tinted disc behind the mark: the shield draws its own silhouette.
  mark: { marginBottom: spacing.xl },
  title: { marginBottom: spacing.sm, textTransform: 'uppercase' },
  subtitle: { maxWidth: 360, marginBottom: spacing.lg },
  recap: { borderTopWidth: 2, borderTopColor: colors.rule },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md },
  reassure: { textAlign: 'center' },
});
