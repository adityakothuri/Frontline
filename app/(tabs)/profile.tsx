import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppText,
  Card,
  EmptyState,
  Loading,
  useLoadingGate,
  OptionGroup,
  PressableScale,
  PrimaryButton,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  TextField,
} from '@/components';
import { useProfile } from '@/services/profile';
import { colors, pressScale, radii, rise, spacing, stagger, withAlpha } from '@/theme';
import { riseIn } from '@/theme/motionPresets';
import { tapImpact } from '@/lib/haptics';
import { stateFromZip } from '@/lib/zipState';
import {
  ROLE_OPTIONS,
  RADIUS_OPTIONS,
  VETERAN_ROLE_LABELS,
  type VeteranRole,
} from '@/types/profile';
import {
  DEFAULT_RADIUS_MILES,
  DOCUMENT_OPTIONS,
  VETERAN_DOCUMENT_LABELS,
  type VeteranDocument,
} from '@/types/need';

type IconName = keyof typeof Ionicons.glyphMap;

/** Short, recognizable summary of the documents on hand (never just a count). */
function documentsSummary(docs: VeteranDocument[]): string {
  if (docs.length === 0) return 'None yet';
  const labels = docs.map((d) => VETERAN_DOCUMENT_LABELS[d]);
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, isHydrated, saveDetails, resetProfile } = useProfile();
  // `?edit=1` lands straight in the form. Results' and Discover's "Change ZIP or
  // radius" send it, because a button that says "change" and drops you on a
  // read-only card is one tap short of its promise. Applied on focus and then
  // cleared, so a second arrival with the same value is seen as a new one — the
  // same consumption pattern Discover uses for its `shell` param.
  const { edit } = useLocalSearchParams<{ edit?: string }>();

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [zip, setZip] = useState(profile?.zip ?? '');
  const [role, setRole] = useState<VeteranRole | undefined>(profile?.role);
  const [docs, setDocs] = useState<VeteranDocument[]>(profile?.documentsOnHand ?? []);
  const [radius, setRadius] = useState<number | undefined>(profile?.preferredRadiusMiles);
  const [saving, setSaving] = useState(false);

  // Reading the profile off disk is usually quicker than `timings.loadingQuiet`,
  // so the common case now shows nothing at all instead of flashing a shield for
  // three frames. Called up here with the other hooks — the hydration branch
  // below is an early return, and hooks cannot live behind one.
  const gate = useLoadingGate(!isHydrated);

  // Keep the form in sync when the stored profile changes (save, or re-setup) —
  // but never while the veteran is typing into it. A backup restore landing
  // mid-edit used to overwrite the draft under their thumbs.
  useEffect(() => {
    if (!profile || editing) return;
    setFirstName(profile.firstName);
    setZip(profile.zip ?? '');
    setRole(profile.role);
    setDocs(profile.documentsOnHand ?? []);
    setRadius(profile.preferredRadiusMiles);
  }, [profile, editing]);

  useFocusEffect(
    useCallback(() => {
      if (edit !== '1' || !profile) return;
      setEditing(true);
      router.setParams({ edit: '' });
    }, [edit, profile, router]),
  );

  // "No profile" is a real, permanent answer — it invites the veteran to set one
  // up. Not-yet-read-from-disk looks identical in `profile` but means nothing of
  // the sort, and showing the invitation there tells a veteran who *has* a
  // profile that they don't. So the read has to finish before either branch
  // below can be trusted.
  //
  // Gated on `holding` rather than `!isHydrated`: if the shield did make it on
  // screen it is owed its finale, and the form waits for the hand-over instead of
  // cutting the celebration off mid-bloom.
  if (gate.holding) {
    return (
      <ScreenContainer>
        {/* No subtitle while the read is in flight. The two branches below say
            different things ("Optional — never required" when there is no profile,
            "Your details, kept on this device" when there is one), and committing
            to either here makes the header appear to reword itself on arrival. */}
        <ScreenHeader title="Profile" />
        {gate.showShield ? (
          <Loading label="Loading your profile…" done={gate.done} onFinish={gate.finish} />
        ) : null}
      </ScreenContainer>
    );
  }

  if (!profile) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Profile" subtitle="Optional — never required" />
        <EmptyState
          icon="person-outline"
          title="Set up Frontline in two minutes"
          message="A first name and a ZIP code are all it takes to find help near you. No sign-in, and nothing sensitive — ever."
          actionLabel="Set up now"
          onAction={() => router.replace('/')}
        />
      </ScreenContainer>
    );
  }

  // The same rule onboarding applies: five digits the state table can place.
  // `00000` used to save here and then fail every search.
  const zipValid = zip.length === 5 && stateFromZip(zip) !== null;
  const canSave = firstName.trim().length > 0 && zipValid;
  const initial = profile.firstName.trim().charAt(0).toUpperCase() || '·';
  const storedDocs = profile.documentsOnHand ?? [];
  // Trimmed, like the save is: a trailing space is not a change worth a
  // "Discard changes?" prompt.
  const dirty =
    firstName.trim() !== profile.firstName ||
    zip !== (profile.zip ?? '') ||
    role !== profile.role ||
    radius !== profile.preferredRadiusMiles ||
    docs.length !== storedDocs.length ||
    docs.some((d) => !storedDocs.includes(d));

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await saveDetails({
        firstName,
        zip,
        role,
        documentsOnHand: docs,
        preferredRadiusMiles: radius,
      });
      setEditing(false);
    } catch {
      Alert.alert("Couldn't save", 'Something went wrong saving your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Discard unsaved edits (confirming first if anything changed) and return to the view.
  const closeEditor = () => {
    setFirstName(profile.firstName);
    setZip(profile.zip ?? '');
    setRole(profile.role);
    setDocs(profile.documentsOnHand ?? []);
    setRadius(profile.preferredRadiusMiles);
    setEditing(false);
  };

  const cancelEdit = () => {
    if (saving) return;
    if (!dirty) {
      closeEditor();
      return;
    }
    Alert.alert('Discard changes?', "Your edits haven't been saved.", [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: closeEditor },
    ]);
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset setup?',
      'This clears your details from this device and starts setup over. Your saved resources are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetProfile();
              router.replace('/');
            } catch {
              Alert.alert(
                'Couldn’t reset',
                'Something went wrong clearing your details. Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  if (editing) {
    return (
      <ScreenContainer scroll keyboardAware>
        <ScreenHeader
          title="Edit profile"
          action={<HeaderButton icon="close" label="Cancel editing" onPress={cancelEdit} />}
        />

        <View style={styles.form}>
          <Section icon="create-outline" title="Your details">
            <TextField
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
            />
            <TextField
              label="ZIP code"
              value={zip}
              onChangeText={(t) => setZip(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 90015"
              keyboardType="number-pad"
              maxLength={5}
              hint={
                zip.length === 5 && !zipValid
                  ? 'That doesn’t look like a US ZIP code — check the digits.'
                  : 'Used only to find nearby resources.'
              }
            />
          </Section>

          <Section icon="medal-outline" title="I am a…">
            <OptionGroup options={ROLE_OPTIONS} value={role} onChange={setRole} />
          </Section>

          <Section icon="folder-open-outline" title="Documents I have">
            <OptionGroup multiple options={DOCUMENT_OPTIONS} value={docs} onChange={setDocs} />
          </Section>

          <Section icon="navigate-outline" title="Search radius">
            <OptionGroup options={RADIUS_OPTIONS} value={radius} onChange={setRadius} />
          </Section>
        </View>

        <PrimaryButton
          label="Save changes"
          onPress={() => {
            tapImpact();
            save();
          }}
          disabled={!canSave}
          loading={saving}
        />

        {/* Accurate about where the data goes. It used to say "it all stays on
            this device" while `pushProfile` mirrored every save to the backup —
            see `services/sync/backupSync.ts`. */}
        <AppText variant="caption" color="textMuted" style={styles.footNote}>
          Only your name and ZIP are required. Everything is kept on this device, with a private
          backup so a new phone can pick up where you left off — never sold or shared.
        </AppText>
      </ScreenContainer>
    );
  }

  return (
    // Scrollable so large accessibility text sizes overflow gracefully; flexGrow keeps
    // the reset link pinned to the bottom when everything fits on one screen.
    // The same staggered arrival every other tab has; this was the one screen
    // that snapped in.
    <ScreenContainer scroll contentStyle={styles.viewContent}>
      <Animated.View entering={riseIn(0, rise.md)}>
        <ScreenHeader
          title="Profile"
          // Live, like every other masthead: the one fact this screen controls.
          subtitle={
            profile.zip
              ? `Searching within ${profile.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES} miles of ${profile.zip}`
              : 'Your details, and how Frontline searches for you'
          }
          action={
            <HeaderButton icon="pencil" label="Edit profile" onPress={() => setEditing(true)} />
          }
        />
      </Animated.View>

      <Animated.View entering={riseIn(stagger.step, rise.md)} style={styles.hero}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <AppText variant="display" style={styles.avatarText}>
              {initial}
            </AppText>
          </View>
        </View>
        <AppText variant="title">{profile.firstName}</AppText>
        {profile.role ? (
          <AppText variant="caption" color="textMuted">
            {VETERAN_ROLE_LABELS[profile.role]}
          </AppText>
        ) : null}
      </Animated.View>

      <Animated.View entering={riseIn(stagger.step * 2, rise.md)}>
        <Card style={styles.infoCard}>
          <InfoRow icon="location-outline" label="ZIP code" value={profile.zip || 'Not set'} />
          <InfoRow
            icon="navigate-outline"
            label="Search radius"
            value={
              profile.preferredRadiusMiles
                ? `${profile.preferredRadiusMiles} miles`
                : `${DEFAULT_RADIUS_MILES} miles (default)`
            }
          />
          <InfoRow
            icon="folder-open-outline"
            label="Documents"
            value={documentsSummary(storedDocs)}
            last
          />
        </Card>
      </Animated.View>

      <View style={styles.spacer} />

      <Animated.View entering={riseIn(stagger.step * 3)}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Reset setup"
          onPress={confirmReset}
          scaleTo={pressScale.chip}
          containerStyle={styles.resetSlot}
          style={styles.reset}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.danger} />
          <AppText variant="label" style={styles.resetLabel}>
            Reset setup
          </AppText>
        </PressableScale>

        <AppText variant="caption" color="textMuted" style={styles.footNote}>
          Frontline never asks for your Social Security number, VA login, bank details, or
          diagnoses.
        </AppText>
      </Animated.View>
    </ScreenContainer>
  );
}

// Small round icon action for the header's trailing slot (edit / cancel).
function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={pressScale.control}
      style={styles.headerButton}
    >
      <Ionicons name={icon} size={18} color={colors.accent} />
    </PressableScale>
  );
}

// One line of the at-a-glance card: a quiet glyph, label, current value. The
// glyph is bare and secondary-ink on purpose — these rows are facts, not
// actions, and olive is reserved for things that do something when tapped.
function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowDivider]}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <AppText variant="body" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong" style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">
        {value}
      </AppText>
    </View>
  );
}

// A form group: the shared section heading over its controls.
function Section({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader size="label" icon={icon} title={title} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  viewContent: { flexGrow: 1 },
  // 44, the floor every other control meets; it was 40 plus hitSlop.
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  avatarRing: {
    padding: spacing.xxs,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.accent, 0.16),
  },
  avatarText: { color: colors.accentPressed },
  infoCard: { paddingVertical: spacing.xs },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  infoRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoValue: { flex: 1, textAlign: 'right' },
  form: { gap: spacing.xl, marginBottom: spacing.xl },
  section: { gap: spacing.sm },
  spacer: { flex: 1 },
  resetSlot: { alignSelf: 'center' },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  // The text-grade red, as `CrisisBanner` uses for the same job.
  resetLabel: { color: colors.dangerText },
  footNote: { marginTop: spacing.sm, textAlign: 'center' },
});
