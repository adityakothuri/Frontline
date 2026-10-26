import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Share, View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppText,
  DataRow,
  Glyph,
  GlyphButton,
  PressableScale,
  SectionHeader,
  TextAction,
  type GlyphName,
} from '@/components';
import { colors, pressScale, spacing, swatchStyle } from '@/theme';
import { isOpenNow } from '@/lib/hours';
import { useProfile } from '@/services/profile';
import { useActivity } from '@/services/activity';
import { useReminders } from '@/services/reminders';
import { aiService, type BenefitSummary, type NextStepPlan } from '@/services/ai';
import { RESOURCE_CATEGORY_META, type Resource } from '@/types/resource';
import { defaultNeedForCategory, type NeedCategory } from '@/types/need';
import { callPhone, openDirections, openWebsite } from './resourceActions';
import { openNowStatus, shortSourceLabel, toReminderSnapshot } from './resourceStatus';
import { SourceRow } from './SourceRow';
import { StatusPill } from './StatusPill';
import { ActionRow } from './ActionRow';
import { AiContentBlock } from './AiContentBlock';
import { DocumentChecklist } from './DocumentChecklist';
import { CallScriptSheet } from './CallScriptSheet';
import { useAiGuidance } from './useAiGuidance';
import { EmergencyCallBanner } from './EmergencyCallBanner';
import { ReminderBell } from './ReminderBell';
import { ResourceRating } from './ResourceRating';
import { VeteranBadge } from './VeteranBadge';

type ResourceDetailProps = {
  resource: Resource;
  /** The need category the veteran searched, for AI context. */
  needCategory: NeedCategory;
};

// The full resource page, top-down: name and status → the action bar → about →
// next steps → what to bring → contact → source. The call script opens in a
// slide-up sheet from the action bar.
export function ResourceDetail({ resource, needCategory }: ResourceDetailProps) {
  const { profile } = useProfile();
  const { recordEngagement } = useActivity();
  const { refreshSnapshots } = useReminders();
  const need = useMemo(
    () => defaultNeedForCategory(needCategory, profile?.zip, profile?.preferredRadiusMiles),
    [needCategory, profile?.zip, profile?.preferredRadiusMiles],
  );

  const [scriptOpen, setScriptOpen] = useState(false);

  // Both calls fire at once; each block paints, fails and retries on its own.
  const summary = useAiGuidance<BenefitSummary>(
    () => aiService.summarizeBenefit({ resource }),
    resource.id,
  );
  // The plan keys on the ZIP too, so it regenerates once the profile hydrates.
  const plan = useAiGuidance<NextStepPlan>(
    () => aiService.buildNextStepPlan({ need, resource }),
    `${resource.id}:${need.location.zip ?? ''}`,
  );

  useEffect(() => {
    // Opening the page counts as engaging — it drives the Home review prompt.
    // Separate from the AI effect so an AI retry never double-counts a view.
    recordEngagement({
      resourceId: resource.id,
      resourceName: resource.name,
      category: resource.category,
      action: 'viewed',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id]);

  useEffect(() => {
    // Refresh any reminder's snapshot from the live record; no-op if unchanged.
    refreshSnapshots([{ resourceId: resource.id, snapshot: toReminderSnapshot(resource) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id, resource.hours, resource.name]);

  const meta = RESOURCE_CATEGORY_META[resource.category];
  const openFlag = isOpenNow(resource.hours);
  const open = openNowStatus(openFlag, resource);
  // No visiting hours for a job posting.
  const showStatus = resource.category !== 'jobs';
  const trust = shortSourceLabel(resource);
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

  const share = () => {
    const lines = [resource.name, resource.address, resource.phone, resource.website].filter(
      (line): line is string => Boolean(line),
    );
    // Fire-and-forget: the OS sheet owns the interaction from here.
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroCategory}>
              <View style={swatchStyle(meta.color, 10)} />
              <AppText variant="kicker">{meta.label}</AppText>
              <VeteranBadge relevance={resource.veteran_relevance} />
            </View>
            <View style={styles.heroTools}>
              {/* Renders nothing unless the hours are good enough to schedule against. */}
              <ReminderBell resource={resource} />
              <GlyphButton name="share" label="Share" framed={false} onPress={share} />
            </View>
          </View>
          <AppText variant="display" style={styles.name}>
            {resource.name}
          </AppText>
          {/* One meta line: open now (not for jobs, which have no hours) and trust. */}
          <View style={styles.meta}>
            {showStatus ? <StatusPill label={open.label} tone={open.tone} /> : null}
            <StatusPill label={trust.label} tone={trust.tone} />
          </View>
          <View style={styles.rule} />
        </View>

        {isEmergency ? (
          <EmergencyCallBanner
            resource={resource}
            onCall={recordAnd('called', () => callPhone(resource.phone as string))}
          />
        ) : null}

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

        <AiContentBlock
          title="About"
          loading={!summary.data}
          loadingLabel="Reading this place…"
          failed={summary.failed}
          onRetry={summary.retry}
        >
          {summary.data ? (
            <>
              <AppText variant="body">{summary.data.whatItIs}</AppText>
              <View>
                <DataRow
                  layout="stacked"
                  label="Qualifies"
                  value={summary.data.whoMayQualify}
                  last={!summary.data.deadlinesOrWarnings}
                />
                {summary.data.deadlinesOrWarnings ? (
                  <DataRow
                    layout="stacked"
                    label="Heads up"
                    value={summary.data.deadlinesOrWarnings}
                    last
                  />
                ) : null}
              </View>
            </>
          ) : null}
        </AiContentBlock>

        <AiContentBlock
          title="Next steps"
          loading={!plan.data}
          loadingLabel="Working out your next steps…"
          failed={plan.failed}
          onRetry={plan.retry}
        >
          {plan.data
            ? // Index-qualified: the model can legitimately repeat a title.
              plan.data.steps.map((step, i) => (
                <View key={`${i}-${step.title}`} style={styles.step}>
                  <AppText variant="data" color="accent" style={styles.stepNum}>
                    {String(i + 1).padStart(2, '0')}
                  </AppText>
                  <View style={styles.stepBody}>
                    <AppText variant="bodyStrong">{step.title}</AppText>
                    <AppText variant="caption" color="textSecondary">
                      {step.detail}
                    </AppText>
                  </View>
                </View>
              ))
            : null}
        </AiContentBlock>

        <Section title="What to bring">
          <DocumentChecklist
            documents={resource.documents_needed}
            suggested={plan.data?.whatToBring}
            onHand={profile?.documentsOnHand}
          />
        </Section>

        <Section title="Contact">
          {resource.phone ? (
            // Recorded as an engagement, like the Call tile.
            <ContactRow
              glyph="call"
              label="Phone"
              text={resource.phone}
              onPress={recordAnd('called', () => callPhone(resource.phone as string))}
            />
          ) : null}
          {resource.website ? (
            <ContactRow
              glyph="globe"
              label="Website"
              text={resource.website}
              onPress={() => openWebsite(resource.website as string)}
            />
          ) : null}
          {resource.address ? (
            <ContactRow glyph="location" label="Address" text={resource.address} />
          ) : null}
          {resource.hours ? <ContactRow glyph="clock" label="Hours" text={resource.hours} /> : null}
        </Section>

        <Section title="Source">
          {/* Carries the source type, the updated date and any licence credit. */}
          <SourceRow resource={resource} size="body" />
          {resource.source_url ? (
            <TextAction
              label="View source"
              onPress={() => openWebsite(resource.source_url as string)}
            />
          ) : null}
        </Section>

        {/* Real votes only (0 until then). */}
        <ResourceRating resourceId={resource.id} />
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
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

// A contact line led by its glyph. Tappable ones (phone, website) read in olive.
function ContactRow({
  glyph,
  label,
  text,
  onPress,
}: {
  glyph: GlyphName;
  label: string;
  text: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.contactRow}>
      <Glyph name={glyph} size={18} color={onPress ? colors.accent : colors.textSecondary} />
      <AppText
        variant="body"
        color={onPress ? 'accent' : 'textPrimary'}
        style={styles.contactText}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {text}
      </AppText>
    </View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${label}: ${text}`}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${text}`}
      onPress={onPress}
      scaleTo={pressScale.subtle}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  hero: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroCategory: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroTools: { flexDirection: 'row', marginVertical: -spacing.md },
  name: { textTransform: 'uppercase' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg },
  rule: { height: 2, backgroundColor: colors.rule, marginTop: spacing.xs },
  section: { gap: spacing.xs },
  step: { flexDirection: 'row', gap: spacing.md },
  stepNum: { marginTop: 3 },
  stepBody: { flex: 1, gap: spacing.xxs },
  // spacing.md padding keeps tappable phone/website rows at >=44pt.
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  contactText: { flex: 1 },
});
