import { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { MapView, Marker } from '@/components/maps';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AlertMarker,
  AppText,
  Card,
  PrimaryButton,
  ScreenContainer,
} from '@/components';
import { colors, fonts, radii, spacing, textVariants } from '@/theme';
import { darkMapStyle } from '@/theme/mapStyle';
import {
  addAlert,
  categoryMeta,
  MAPLE_GROVE_CENTER,
  MAPLE_GROVE_REGION,
  orderedCategories,
  orderedSeverities,
  severityColor,
  severityLabel,
  type AlertCategory,
  type AlertSeverity,
  type Coordinates,
} from '@/mock/alerts';

const TTL_OPTIONS = [
  { label: '2 hours', hours: 2 },
  { label: '6 hours', hours: 6 },
  { label: '24 hours', hours: 24 },
];

export default function ReportScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<AlertCategory | null>(null);
  const [severity, setSeverity] = useState<AlertSeverity>('medium');
  const [description, setDescription] = useState('');
  const [coordinate, setCoordinate] = useState<Coordinates>(MAPLE_GROVE_CENTER);
  const [ttlHours, setTtlHours] = useState(6);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    category !== null && description.trim().length > 0 && !submitting;

  const submit = () => {
    if (!category || !canSubmit) return;
    setSubmitting(true);
    addAlert({ category, severity, description, coordinate, ttlHours })
      .then(() => router.back())
      .catch(() => setSubmitting(false));
  };

  return (
    <ScreenContainer scroll keyboardAware edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <AppText variant="title">Report an alert</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.close}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
      <AppText variant="body" color="textSecondary" style={styles.intro}>
        Let neighbors know what you saw. Reports are anonymous and clear
        themselves after the time you choose.
      </AppText>

      <AppText variant="subtitle" style={styles.label}>
        What did you see?
      </AppText>
      <View style={styles.chips}>
        {orderedCategories.map((c) => {
          const selected = c === category;
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              onPress={() => setCategory(c)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Ionicons
                name={categoryMeta[c].icon}
                size={16}
                color={selected ? colors.accent : colors.textSecondary}
              />
              <AppText
                variant="label"
                color={selected ? 'accent' : 'textSecondary'}
              >
                {categoryMeta[c].label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <AppText variant="subtitle" style={styles.label}>
        How serious?
      </AppText>
      <View style={styles.segment}>
        {orderedSeverities.map((s) => {
          const selected = s === severity;
          const tint = colors[severityColor[s]];
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              onPress={() => setSeverity(s)}
              style={[
                styles.segmentItem,
                selected && { backgroundColor: tint, borderColor: tint },
              ]}
            >
              <AppText
                variant="label"
                color={selected ? 'textOnAccent' : 'textSecondary'}
              >
                {severityLabel[s]}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <AppText variant="subtitle" style={styles.label}>
        Describe it
      </AppText>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Someone checking car door handles on Maple St"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={280}
      />

      <AppText variant="subtitle" style={styles.label}>
        Where?
      </AppText>
      <Card style={styles.mapCard}>
        <MapView
          style={styles.miniMap}
          initialRegion={MAPLE_GROVE_REGION}
          userInterfaceStyle="dark"
          customMapStyle={darkMapStyle}
          showsCompass={false}
          toolbarEnabled={false}
          onPress={(e) => setCoordinate(e.nativeEvent.coordinate)}
        >
          <Marker
            draggable
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 1 }}
            onDragEnd={(e) => setCoordinate(e.nativeEvent.coordinate)}
          >
            <AlertMarker category={category ?? 'other'} severity={severity} />
          </Marker>
        </MapView>
      </Card>
      <AppText variant="caption" color="textMuted" style={styles.hint}>
        Tap the map to set the location, then drag the pin to fine-tune.
      </AppText>

      <AppText variant="subtitle" style={styles.label}>
        Auto-delete after
      </AppText>
      <View style={styles.chips}>
        {TTL_OPTIONS.map((opt) => {
          const selected = opt.hours === ttlHours;
          return (
            <Pressable
              key={opt.hours}
              accessibilityRole="button"
              onPress={() => setTtlHours(opt.hours)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <AppText
                variant="label"
                color={selected ? 'accent' : 'textSecondary'}
              >
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton
        label="Post to neighborhood"
        onPress={submit}
        disabled={!canSubmit}
        loading={submitting}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  intro: { marginBottom: spacing.sm },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 96,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: textVariants.body.fontSize,
    textAlignVertical: 'top',
  },
  mapCard: { padding: 0, overflow: 'hidden' },
  miniMap: { height: 200 },
  hint: { marginTop: spacing.xs },
  submit: { marginTop: spacing.xl },
});
