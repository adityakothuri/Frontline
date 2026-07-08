import { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  Chip,
  ErrorState,
  PrimaryButton,
  ScreenContainer,
} from '@/components';
import { colors, fonts, radii, spacing } from '@/theme';
import {
  DEFAULT_RADIUS_MILES,
  HELP_TYPE_LABELS,
  MODALITY_LABELS,
  NEED_CATEGORY_META,
  URGENCY_LABELS,
  VETERAN_DOCUMENT_LABELS,
  type HelpType,
  type Modality,
  type NeedCategory,
  type Urgency,
  type VeteranDocument,
} from '@/types/need';

const keysOf = <T extends string>(record: Record<T, string>): T[] =>
  Object.keys(record) as T[];

// The guided flow: a category + a few quick questions → a structured Need that
// drives discovery. Sensible defaults are pre-selected so it's fast; the veteran
// only changes what matters to them.
export default function NeedFlowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category: NeedCategory }>();
  const category = params.category;

  const [urgency, setUrgency] = useState<Urgency>('this_week');
  const [modality, setModality] = useState<Modality>('either');
  const [helpType, setHelpType] = useState<HelpType>('understand');
  const [documents, setDocuments] = useState<VeteranDocument[]>([]);
  const [zip, setZip] = useState('');

  if (!category || !NEED_CATEGORY_META[category]) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Unknown category"
          message="Go back and pick what you need help with."
          onRetry={() => router.replace('/home')}
        />
      </ScreenContainer>
    );
  }

  const meta = NEED_CATEGORY_META[category];

  const toggleDocument = (doc: VeteranDocument) => {
    setDocuments((current) =>
      current.includes(doc) ? current.filter((d) => d !== doc) : [...current, doc],
    );
  };

  const seeResources = () => {
    router.push({
      pathname: '/results',
      params: {
        category,
        urgency,
        modality,
        helpType,
        documents: documents.join(','),
        zip: zip.trim(),
        radius: String(DEFAULT_RADIUS_MILES),
      },
    });
  };

  return (
    <ScreenContainer scroll keyboardAware>
      <Stack.Screen options={{ title: meta.label }} />

      <AppText variant="title">{meta.label}</AppText>
      <AppText variant="body" color="textSecondary" style={styles.intro}>
        A few quick questions so we can point you to the right help.
      </AppText>

      <Question label="How soon do you need help?">
        {keysOf(URGENCY_LABELS).map((value) => (
          <Chip
            key={value}
            label={URGENCY_LABELS[value]}
            selected={urgency === value}
            onPress={() => setUrgency(value)}
          />
        ))}
      </Question>

      <Question label="In person or online?">
        {keysOf(MODALITY_LABELS).map((value) => (
          <Chip
            key={value}
            label={MODALITY_LABELS[value]}
            selected={modality === value}
            onPress={() => setModality(value)}
          />
        ))}
      </Question>

      <Question label="What kind of help do you want?">
        {keysOf(HELP_TYPE_LABELS).map((value) => (
          <Chip
            key={value}
            label={HELP_TYPE_LABELS[value]}
            selected={helpType === value}
            onPress={() => setHelpType(value)}
          />
        ))}
      </Question>

      <Question label="Which of these do you already have? (optional)">
        {keysOf(VETERAN_DOCUMENT_LABELS).map((value) => (
          <Chip
            key={value}
            label={VETERAN_DOCUMENT_LABELS[value]}
            selected={documents.includes(value)}
            onPress={() => toggleDocument(value)}
          />
        ))}
      </Question>

      <View style={styles.zipBlock}>
        <AppText variant="label" color="textSecondary">
          ZIP code (optional)
        </AppText>
        <TextInput
          value={zip}
          onChangeText={(text) => setZip(text.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 90015"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={5}
          style={styles.zipInput}
        />
        <AppText variant="caption" color="textMuted">
          Used only to find nearby resources. We don’t store it.
        </AppText>
      </View>

      <PrimaryButton label="See resources" onPress={seeResources} style={styles.cta} />
    </ScreenContainer>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.question}>
      <AppText variant="subtitle" style={styles.questionLabel}>
        {label}
      </AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: spacing.xs, marginBottom: spacing.xl },
  question: { marginBottom: spacing.xl },
  questionLabel: { marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  zipBlock: { gap: spacing.sm, marginBottom: spacing.xl },
  zipInput: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  cta: { marginTop: spacing.sm },
});
