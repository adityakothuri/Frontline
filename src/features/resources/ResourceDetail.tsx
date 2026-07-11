import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, ScrollView, Pressable, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components';
import { colors, radii, spacing } from '@/theme';
import { isOpenNow } from '@/lib/hours';
import { simulatedRating } from '@/lib/ratings';
import { useProfile } from '@/services/profile';
import { useActivity } from '@/services/activity';
import {
  aiService,
  AI_NOT_ADVICE_DISCLAIMER,
  type BenefitSummary,
  type NextStepPlan,
} from '@/services/ai';
import { RESOURCE_CATEGORY_META, type Resource } from '@/types/resource';
import { defaultNeedForCategory, type NeedCategory } from '@/types/need';
import { callPhone, openDirections } from './resourceActions';
import { openNowStatus, sourceStatus, formatCheckedDate, STATUS_TONE_COLOR } from './resourceStatus';
import { StatusPill } from './StatusPill';
import { ActionRow } from './ActionRow';
import { AiContentBlock } from './AiContentBlock';
import { DocumentChecklist } from './DocumentChecklist';
import { CallScriptSheet } from './CallScriptSheet';
import { EmergencyCallBanner } from './EmergencyCallBanner';

type ResourceDetailProps = {
  resource: Resource;
  /** The need category the veteran searched, for AI context. */
  needCategory: NeedCategory;
};

// The full resource page, top-down: what it is → every action in one row under
// the header → what to do → what to bring → how to reach it → trust. The call
// script opens in a slide-up sheet from the action row.
export function ResourceDetail({ resource, needCategory }: ResourceDetailProps) {
  const { profile } = useProfile();
  const { recordEngagement } = useActivity();
  const need = useMemo(
    () => defaultNeedForCategory(needCategory, profile?.zip, profile?.preferredRadiusMiles),
    [needCategory, profile?.zip, profile?.preferredRadiusMiles],
  );
  const rating = simulatedRating(resource.id);

  const [summary, setSummary] = useState<BenefitSummary | null>(null);
  const [plan, setPlan] = useState<NextStepPlan | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);

  useEffect(() => {
    let active = true;
    aiService.summarizeBenefit({ resource }).then((s) => active && setSummary(s));
    aiService.buildNextStepPlan({ need, resource }).then((p) => active && setPlan(p));
    // Opening the page counts as engaging — it drives the Home review prompt.
    recordEngagement({
      resourceId: resource.id,
      resourceName: resource.name,
      category: resource.category,
      action: 'viewed',
    });
    return () => {
      active = false;
    };
    // Reload only when the resource changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id]);

  const meta = RESOURCE_CATEGORY_META[resource.category];
  const open = openNowStatus(isOpenNow(resource.hours));
  const source = sourceStatus(resource);
  const hasDirections =
    resource.address !== null || (resource.latitude !== null && resource.longitude !== null);
  const isEmergency = resource.category === 'emergency';

  const recordAnd = (action: 'called' | 'directions', run: () => void) => () => {
    recordEngagement({
      resourceId: resource.id,
      resourceName: resource.name,
      category: resource.category,
      action,
    });
    run();
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.categoryChip}>
            <Ionicons name={meta.icon} size={14} color={meta.color} />
            <AppText variant="caption" color="textSecondary">
              {meta.label}
            </AppText>
          </View>
          <AppText variant="title">{resource.name}</AppText>
          <View style={styles.headerMeta}>
            <StatusPill label={open.label} tone={open.tone} />
            <View style={styles.ratingChip}>
              <Ionicons name="star" size={13} color={colors.warning} />
              <AppText variant="caption" color="textMuted">
                {rating.average.toFixed(1)} · simulated (demo)
              </AppText>
            </View>
          </View>
        </View>

        {/* Emergency: a prominent way to call, right up top */}
        {isEmergency ? (
          <EmergencyCallBanner
            resource={resource}
            onCall={recordAnd('called', () => callPhone(resource.phone as string))}
          />
        ) : null}

        {/* Every action, one compact cluster — Call stays above the fold */}
        <ActionRow
          resource={resource}
          onCall={
            resource.phone
              ? recordAnd('called', () => callPhone(resource.phone as string))
              : undefined
          }
          onDirections={
            hasDirections ? recordAnd('directions', () => openDirections(resource)) : undefined
          }
          onGetScript={resource.phone ? () => setScriptOpen(true) : undefined}
        />

        {/* What it is */}
        <AiContentBlock
          title="Summary"
          loading={!summary}
          disclaimer={summary ? AI_NOT_ADVICE_DISCLAIMER : undefined}
        >
          {summary ? (
            <>
              <SummaryLine label="What it is" value={summary.whatItIs} />
              <SummaryLine label="Who may qualify" value={summary.whoMayQualify} />
              {summary.deadlinesOrWarnings ? (
                <SummaryLine label="Heads up" value={summary.deadlinesOrWarnings} />
              ) : null}
            </>
          ) : null}
        </AiContentBlock>

        {/* What to do */}
        <AiContentBlock title="Your next steps" loading={!plan} disclaimer={plan?.disclaimer ?? undefined}>
          {plan ? (
            <>
              {plan.steps.map((step, i) => (
                <View key={step.title} style={styles.step}>
                  <View style={styles.stepNum}>
                    <AppText variant="label" color="textOnAccent">
                      {i + 1}
                    </AppText>
                  </View>
                  <View style={styles.stepBody}>
                    <AppText variant="bodyStrong">{step.title}</AppText>
                    <AppText variant="body" color="textSecondary">
                      {step.detail}
                    </AppText>
                  </View>
                </View>
              ))}
              {plan.backup ? (
                <AppText variant="body" color="textSecondary" style={styles.backup}>
                  {plan.backup}
                </AppText>
              ) : null}
            </>
          ) : null}
        </AiContentBlock>

        {/* What to bring */}
        <Section title="What should I bring?">
          <DocumentChecklist documents={resource.documents_needed} />
        </Section>

        {/* How to reach it */}
        <Section title="Contact">
          {resource.phone ? (
            <ContactRow icon="call-outline" text={resource.phone} onPress={() => callPhone(resource.phone as string)} />
          ) : null}
          {resource.website ? (
            <ContactRow icon="globe-outline" text={resource.website} onPress={() => Linking.openURL(resource.website as string)} />
          ) : null}
          {resource.address ? <ContactRow icon="location-outline" text={resource.address} /> : null}
          {resource.hours ? <ContactRow icon="time-outline" text={resource.hours} /> : null}
        </Section>

        {/* Trust */}
        <Section title="Trust & verification">
          <View style={styles.sourceRow}>
            <Ionicons
              name={source.tone === 'success' ? 'shield-checkmark-outline' : 'alert-circle-outline'}
              size={15}
              color={STATUS_TONE_COLOR[source.tone]}
            />
            <AppText variant="body" style={{ color: STATUS_TONE_COLOR[source.tone] }}>
              {source.label}
            </AppText>
          </View>
          <AppText variant="caption" color="textMuted">
            Last checked {formatCheckedDate(resource.last_checked)}
          </AppText>
          {resource.source_url ? (
            <ContactRow icon="open-outline" text="View the source" onPress={() => Linking.openURL(resource.source_url as string)} />
          ) : null}
        </Section>

      </ScrollView>

      {/* The call script rides in a sheet so the page itself stays short */}
      <CallScriptSheet
        visible={scriptOpen}
        onClose={() => setScriptOpen(false)}
        need={need}
        resource={resource}
        firstName={profile?.firstName}
        tone={isEmergency ? 'short' : 'standard'}
      />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
}

function ContactRow({
  icon,
  text,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.contactRow}>
      <Ionicons name={icon} size={18} color={onPress ? colors.accent : colors.textMuted} />
      <AppText variant="body" color={onPress ? 'textPrimary' : 'textSecondary'} style={styles.contactText}>
        {text}
      </AppText>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  header: { gap: spacing.sm },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.sm },
  summaryLine: { gap: 2 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  step: { flexDirection: 'row', gap: spacing.sm },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: { flex: 1, gap: 2 },
  backup: { marginTop: spacing.xs, fontStyle: 'italic' },
  // spacing.md padding keeps tappable phone/website rows at >=44pt.
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  contactText: { flex: 1 },
  pressed: { opacity: 0.6 },
});
