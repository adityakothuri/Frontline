import { useEffect, useState, type ReactNode } from 'react';
import { View, Alert, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppText,
  Card,
  EmptyState,
  OptionGroup,
  PrimaryButton,
  ScreenContainer,
  ScreenHeader,
  TextField,
} from '@/components';
import { useProfile } from '@/services/profile';
import { colors, radii, spacing, withAlpha } from '@/theme';
import { ROLE_OPTIONS, RADIUS_OPTIONS, VETERAN_ROLE_LABELS, type VeteranRole } from '@/types/profile';
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
  const { profile, saveDetails, resetProfile } = useProfile();

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [zip, setZip] = useState(profile?.zip ?? '');
  const [role, setRole] = useState<VeteranRole | undefined>(profile?.role);
  const [docs, setDocs] = useState<VeteranDocument[]>(profile?.documentsOnHand ?? []);
  const [radius, setRadius] = useState<number | undefined>(profile?.preferredRadiusMiles);
  const [saving, setSaving] = useState(false);

  // Keep the form in sync when the stored profile changes (save, or re-setup).
  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName);
    setZip(profile.zip ?? '');
    setRole(profile.role);
    setDocs(profile.documentsOnHand ?? []);
    setRadius(profile.preferredRadiusMiles);
  }, [profile]);

  if (!profile) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Profile" subtitle="Optional — never required" />
        <EmptyState
          icon="person-outline"
          title="Your preferences will live here"
          message="Set up Frontline to personalize your experience. Frontline never asks for sensitive information."
          actionLabel="Set up now"
          onAction={() => router.replace('/')}
        />
      </ScreenContainer>
    );
  }

  const canSave = firstName.trim().length > 0 && zip.length === 5;
  const initial = profile.firstName.trim().charAt(0).toUpperCase() || '·';
  const storedDocs = profile.documentsOnHand ?? [];
  const dirty =
    firstName !== profile.firstName ||
    zip !== (profile.zip ?? '') ||
    role !== profile.role ||
    radius !== profile.preferredRadiusMiles ||
    docs.length !== storedDocs.length ||
    docs.some((d) => !storedDocs.includes(d));

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await saveDetails({ firstName, zip, role, documentsOnHand: docs, preferredRadiusMiles: radius });
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
            await resetProfile();
            router.replace('/');
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
          <Section icon="create-outline" label="Your details">
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
              hint="Used only to find nearby resources."
            />
          </Section>

          <Section icon="medal-outline" label="I am a…">
            <OptionGroup options={ROLE_OPTIONS} value={role} onChange={setRole} />
          </Section>

          <Section icon="folder-open-outline" label="Documents I have">
            <OptionGroup multiple options={DOCUMENT_OPTIONS} value={docs} onChange={setDocs} />
          </Section>

          <Section icon="navigate-outline" label="Search radius">
            <OptionGroup options={RADIUS_OPTIONS} value={radius} onChange={setRadius} />
          </Section>
        </View>

        <PrimaryButton label="Save changes" onPress={save} disabled={!canSave} loading={saving} />

        <AppText variant="caption" color="textMuted" style={styles.footNote}>
          Everything here is optional except your name and ZIP, and it all stays on this device.
        </AppText>
      </ScreenContainer>
    );
  }

  return (
    // Scrollable so large accessibility text sizes overflow gracefully; flexGrow keeps
    // the reset link pinned to the bottom when everything fits on one screen.
    <ScreenContainer scroll contentStyle={styles.viewContent}>
      <ScreenHeader
        title="Profile"
        subtitle="Your details, kept on this device"
        action={<HeaderButton icon="pencil" label="Edit profile" onPress={() => setEditing(true)} />}
      />

      <View style={styles.hero}>
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
      </View>

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
        <InfoRow icon="folder-open-outline" label="Documents" value={documentsSummary(storedDocs)} last />
      </Card>

      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        onPress={confirmReset}
        hitSlop={8}
        style={({ pressed }) => [styles.reset, pressed && styles.resetPressed]}
      >
        <Ionicons name="refresh-outline" size={16} color={colors.danger} />
        <AppText variant="label" style={styles.resetLabel}>
          Reset setup
        </AppText>
      </Pressable>

      <AppText variant="caption" color="textMuted" style={styles.footNote}>
        Frontline never asks for sensitive information.
      </AppText>
    </ScreenContainer>
  );
}

// Small round icon action for the header's trailing slot (edit / cancel).
function HeaderButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
    >
      <Ionicons name={icon} size={18} color={colors.accent} />
    </Pressable>
  );
}

// One line of the at-a-glance card: olive icon chip, label, current value.
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
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={15} color={colors.accent} />
      </View>
      <AppText variant="body" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong" style={styles.infoValue}>
        {value}
      </AppText>
    </View>
  );
}

function Section({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={16} color={colors.accent} />
        <AppText variant="subtitle">{label}</AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  viewContent: { flexGrow: 1 },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  headerButtonPressed: { opacity: 0.6 },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  avatarRing: {
    padding: 3,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radii.pill,
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
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  infoValue: { flex: 1, textAlign: 'right' },
  form: { gap: spacing.xl, marginBottom: spacing.xl },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spacer: { flex: 1 },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  resetPressed: { opacity: 0.6 },
  resetLabel: { color: colors.danger },
  footNote: { marginTop: spacing.sm, textAlign: 'center' },
});
