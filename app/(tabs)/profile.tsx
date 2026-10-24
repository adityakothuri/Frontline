import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  DataRow,
  EmptyState,
  Loading,
  useLoadingGate,
  OptionGroup,
  PrimaryButton,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  TextAction,
  TextField,
} from '@/components';
import { useProfile } from '@/services/profile';
import { spacing } from '@/theme';
import { tapImpact } from '@/lib/haptics';
import { stateFromZip } from '@/lib/zipState';
import {
  ROLE_OPTIONS,
  RADIUS_OPTIONS,
  VETERAN_ROLE_LABELS,
  type VeteranRole,
} from '@/types/profile';
import { DEFAULT_RADIUS_MILES, DOCUMENT_OPTIONS, type VeteranDocument } from '@/types/need';
import { useSaved } from '@/services/saved';
import { useReminders } from '@/services/reminders';
import { DocumentsOnHand } from '@/features/profile/DocumentsOnHand';

/** "OCT 2026", or null when the stored timestamp can't be read. */
function sinceLabel(createdAt: string): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
}

const NEVER_ASKED = [
  'Never your Social Security number',
  'Never your VA login',
  'Never bank details or diagnoses',
];

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, isHydrated, saveDetails, resetProfile } = useProfile();
  const { savedIds } = useSaved();
  const { reminderCount } = useReminders();
  // `?edit=1` (sent by "Change ZIP or radius") opens the form directly. Applied
  // on focus and then cleared, so the same value can arrive again.
  const { edit } = useLocalSearchParams<{ edit?: string }>();

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [zip, setZip] = useState(profile?.zip ?? '');
  const [role, setRole] = useState<VeteranRole | undefined>(profile?.role);
  const [docs, setDocs] = useState<VeteranDocument[]>(profile?.documentsOnHand ?? []);
  const [radius, setRadius] = useState<number | undefined>(profile?.preferredRadiusMiles);
  const [saving, setSaving] = useState(false);

  // Declared with the other hooks because the hydration branch returns early.
  const gate = useLoadingGate(!isHydrated);

  // Follow the stored profile (a save, a backup restore), but never mid-edit.
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

  // Before hydration `profile` is null for everyone, so neither branch below can
  // be trusted yet. `holding` (not `!isHydrated`) lets a visible shield finish.
  if (gate.holding) {
    return (
      <ScreenContainer>
        {/* No subtitle yet: the two branches below word it differently. */}
        <ScreenHeader title="Profile" />
        {gate.showShield ? <Loading label="Loading your profile…" /> : null}
      </ScreenContainer>
    );
  }

  if (!profile) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Profile" subtitle="Optional — never required" />
        <EmptyState
          title="Set up Frontline in two minutes"
          message="A first name and a ZIP code are all it takes to find help near you. No sign-in, and nothing sensitive — ever."
          actionLabel="Set up now"
          onAction={() => router.replace('/')}
        />
      </ScreenContainer>
    );
  }

  // The same rule onboarding applies: five digits the state table can place.
  const zipValid = zip.length === 5 && stateFromZip(zip) !== null;
  const canSave = firstName.trim().length > 0 && zipValid;
  const storedDocs = profile.documentsOnHand ?? [];
  // Trimmed like the save, so a trailing space doesn't prompt "Discard changes?".
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
          action={<TextAction label="Cancel" onPress={cancelEdit} />}
        />

        <View style={styles.form}>
          <Section number={1} title="Your details">
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

          <Section number={2} title="I am a…">
            <OptionGroup options={ROLE_OPTIONS} value={role} onChange={setRole} />
          </Section>

          <Section number={3} title="Documents I have">
            <OptionGroup multiple options={DOCUMENT_OPTIONS} value={docs} onChange={setDocs} />
          </Section>

          <Section number={4} title="Search radius">
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

        {/* Saves are mirrored to the device backup (services/sync/backupSync.ts). */}
        <AppText variant="caption" color="textSecondary" style={styles.footNote}>
          Only your name and ZIP are required. Everything is kept on this device, with a private
          backup so a new phone can pick up where you left off — never sold or shared.
        </AppText>
      </ScreenContainer>
    );
  }

  const radiusMiles = profile.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES;
  const roleLabel = profile.role ? VETERAN_ROLE_LABELS[profile.role] : null;
  const since = sinceLabel(profile.createdAt);
  const identity = [roleLabel?.toUpperCase(), since ? `ON FRONTLINE SINCE ${since}` : null]
    .filter(Boolean)
    .join(' · ');
  const activity =
    savedIds.length === 0 && reminderCount === 0
      ? 'NOTHING SAVED YET'
      : [
          `${savedIds.length} SAVED`,
          reminderCount > 0
            ? `${reminderCount} REMINDER${reminderCount === 1 ? '' : 'S'} ON`
            : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    // flexGrow pins the reset link to the bottom when everything fits.
    <ScreenContainer scroll contentStyle={styles.viewContent}>
      <ScreenHeader
        title="Profile"
        subtitle="Only what you chose to share."
        action={<TextAction label="Edit" onPress={() => setEditing(true)} />}
      />

      <View style={styles.identity}>
        <AppText variant="title" style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
          {profile.firstName}
        </AppText>
        {identity ? (
          <AppText variant="kicker" color="textSecondary">
            {identity}
          </AppText>
        ) : null}
        <View style={styles.activity}>
          <AppText variant="data" style={styles.activityText}>
            {activity}
          </AppText>
          {savedIds.length > 0 ? (
            <TextAction
              label="View"
              onPress={() => router.navigate('/saved')}
              accessibilityHint="Opens your saved places"
            />
          ) : null}
        </View>
      </View>

      <View style={styles.sections}>
        <View style={styles.section}>
          <SectionHeader number={1} title="Search area" />
          <View>
            <DataRow label="ZIP code" value={profile.zip || 'Not set'} />
            <DataRow
              label="Radius"
              value={
                profile.preferredRadiusMiles
                  ? `${radiusMiles} miles`
                  : `${radiusMiles} miles (default)`
              }
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <SectionHeader
              number={2}
              title="Documents on hand"
              caption="Frontline uses this to tell you what to bring."
              style={styles.sectionTitle}
            />
            <AppText variant="data" color="textSecondary">
              {`${storedDocs.length} OF ${DOCUMENT_OPTIONS.length}`}
            </AppText>
          </View>
          <DocumentsOnHand held={storedDocs} />
        </View>

        <View style={styles.section}>
          <SectionHeader number={3} title="Privacy" />
          <View>
            {NEVER_ASKED.map((line) => (
              <View key={line} style={styles.neverRow}>
                <AppText variant="data" color="textSecondary">
                  —
                </AppText>
                <AppText variant="body" style={styles.neverText}>
                  {line}
                </AppText>
              </View>
            ))}
          </View>
          <AppText variant="caption" color="textSecondary">
            Kept on this device, with a private backup so a new phone can pick up where you left
            off. Never sold or shared.
          </AppText>
        </View>
      </View>

      <View style={styles.foot}>
        <TextAction label="Reset setup" tone="textPrimary" onPress={confirmReset} />
      </View>
    </ScreenContainer>
  );
}

// A form group: the shared section heading over its controls.
function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader number={number} title={title} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  viewContent: { flexGrow: 1 },
  form: { gap: spacing.xl, marginBottom: spacing.xl },
  section: { gap: spacing.sm },
  identity: { gap: spacing.xs, marginBottom: spacing.xl },
  name: { textTransform: 'uppercase' },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
  },
  activityText: { flexShrink: 1 },
  sections: { gap: spacing.xxl },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  sectionTitle: { flex: 1 },
  neverRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  neverText: { flex: 1 },
  foot: { marginTop: 'auto', paddingTop: spacing.xl },
  footNote: { marginTop: spacing.sm },
});
