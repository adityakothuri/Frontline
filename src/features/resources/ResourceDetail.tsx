import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppText,
  CategoryMedallion,
  NavigatorDisclaimer,
  PressableScale,
  SectionHeader,
} from '@/components';
import { colors, pressScale, radii, rise, spacing, stagger, surfaceTint } from '@/theme';
import { heroMedallionIn, riseIn } from '@/theme/motionPresets';
import { isOpenNow } from '@/lib/hours';
import { useProfile } from '@/services/profile';
import { useActivity } from '@/services/activity';
import { useReminders } from '@/services/reminders';
import {
  aiService,
  AI_NOT_ADVICE_DISCLAIMER,
  type BenefitSummary,
  type NextStepPlan,
} from '@/services/ai';
import { RESOURCE_CATEGORY_META, type Resource } from '@/types/resource';
import { defaultNeedForCategory, type NeedCategory } from '@/types/need';
import { callPhone, openDirections, openWebsite } from './resourceActions';
import { openNowStatus, toReminderSnapshot, trustWarning } from './resourceStatus';
import { SourceRow } from './SourceRow';
import { StatusPill } from './StatusPill';
import { ActionRow } from './ActionRow';
import { AiContentBlock } from './AiContentBlock';
import { DocumentChecklist } from './DocumentChecklist';
import { CallScriptSheet } from './CallScriptSheet';
import { useAiGuidance } from './useAiGuidance';
import { EmergencyCallBanner } from './EmergencyCallBanner';
import { ResourceRating } from './ResourceRating';

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
  const { refreshSnapshots } = useReminders();
  const need = useMemo(
    () => defaultNeedForCategory(needCategory, profile?.zip, profile?.preferredRadiusMiles),
    [needCategory, profile?.zip, profile?.preferredRadiusMiles],
  );

  const [scriptOpen, setScriptOpen] = useState(false);

  // Both calls fire at once and each block paints the moment its own lands, so a
  // veteran reads whichever guidance is ready instead of waiting on the slower
  // of the two. Each also fails and retries on its own.
  const summary = useAiGuidance<BenefitSummary>(
    () => aiService.summarizeBenefit({ resource }),
    resource.id,
  );
  // The plan is built from the need, so it keys on the ZIP as well as the
  // resource: a page opened before the profile hydrated would otherwise keep
  // showing location-less next steps after the ZIP arrived. (The summary is
  // about the resource alone, so the id is the whole key there.)
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
    // Opportunistic: this page already has the live record, so any reminder on
    // it gets fresh hours and a fresh trust line without a dedicated fetch.
    // A no-op unless something the schedule depends on actually changed.
    refreshSnapshots([{ resourceId: resource.id, snapshot: toReminderSnapshot(resource) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id, resource.hours, resource.name]);

  const meta = RESOURCE_CATEGORY_META[resource.category];
  const open = openNowStatus(isOpenNow(resource.hours));
  // Job postings have no visiting hours, so the open-now pill would be noise.
  const showStatus = resource.category !== 'jobs';
  const warning = trustWarning(resource);
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
        {/* Category hero — a soft header zone in the category's own hue, so every
            resource type opens with a distinct, premium identity. The medallion
            rides beside the category label (same pattern as ResourceCard) rather
            than on its own line, so the name stays high on the page. Full-bleed
            under the nav header. */}
        <Animated.View
          entering={riseIn(0, rise.md)}
          style={[styles.hero, { backgroundColor: surfaceTint(meta.color, 0.14) }]}
        >
          <View style={styles.heroCategory}>
            {/* The medallion arrives at the size it left on the card (44 -> 36),
                so opening a resource reads as the card growing into the page
                rather than a new screen appearing. */}
            <Animated.View entering={heroMedallionIn()}>
              <CategoryMedallion icon={meta.icon} color={meta.color} size={36} />
            </Animated.View>
            <AppText variant="label" color="textSecondary">
              {meta.label}
            </AppText>
          </View>
          <AppText variant="title">{resource.name}</AppText>
          {/* Jobs have no visiting hours, so the wrapper is skipped entirely
              rather than left to contribute empty space to the hero. */}
          {showStatus ? (
            <View style={styles.headerMeta}>
              <StatusPill label={open.label} tone={open.tone} />
            </View>
          ) : null}
        </Animated.View>

        {/* Rating sits below the tinted hero so its muted caption keeps AA
            contrast on the plain paper background. Real votes only (0 until then). */}
        <Animated.View entering={riseIn(stagger.step)}>
          <ResourceRating resourceId={resource.id} />
        </Animated.View>

        {/* Emergency: a prominent way to call, right up top */}
        {isEmergency ? (
          <Animated.View entering={riseIn(stagger.step * 2)}>
            <EmergencyCallBanner
              resource={resource}
              onCall={recordAnd('called', () => callPhone(resource.phone as string))}
            />
          </Animated.View>
        ) : null}

        {/* Every action, one compact cluster — Call stays above the fold.
            The stagger stops here: everything below is off-screen on arrival,
            so animating it would be cost with nothing to show for it. */}
        <Animated.View entering={riseIn(stagger.step * (isEmergency ? 3 : 2))}>
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
        </Animated.View>

        {/* What it is */}
        <AiContentBlock
          title="Summary"
          color={meta.color}
          loading={!summary.data}
          loadingLabel="Reading this resource…"
          failed={summary.failed}
          onRetry={summary.retry}
        >
          {summary.data ? (
            <>
              <SummaryLine label="What it is" value={summary.data.whatItIs} />
              <SummaryLine label="Who may qualify" value={summary.data.whoMayQualify} />
              {summary.data.deadlinesOrWarnings ? (
                <SummaryLine label="Heads up" value={summary.data.deadlinesOrWarnings} />
              ) : null}
            </>
          ) : null}
        </AiContentBlock>

        {/* What to do */}
        <AiContentBlock
          title="Your next steps"
          color={meta.color}
          loading={!plan.data}
          loadingLabel="Working out your next steps…"
          failed={plan.failed}
          onRetry={plan.retry}
        >
          {plan.data ? (
            <>
              {/* Index-qualified: the model can legitimately repeat a title. */}
              {plan.data.steps.map((step, i) => (
                <View key={`${i}-${step.title}`} style={styles.step}>
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
              {plan.data.backup ? (
                <AppText variant="body" color="textSecondary" style={styles.backup}>
                  {plan.data.backup}
                </AppText>
              ) : null}
            </>
          ) : null}
        </AiContentBlock>

        {/* The one place the not-advice line is said on this page, under both AI
            blocks rather than inside each: the blocks carry the short
            "AI-generated" tag, this carries the whole sentence. It was defined
            in `AiService.ts` as "attached to every AI surface" and rendered
            nowhere. */}
        <NavigatorDisclaimer text={AI_NOT_ADVICE_DISCLAIMER} />

        {/* What to bring — the listing's own documents, the plan's suggestions,
            and the veteran's answer from onboarding, in one list. */}
        <Section title="What should I bring?">
          <DocumentChecklist
            documents={resource.documents_needed}
            suggested={plan.data?.whatToBring}
            onHand={profile?.documentsOnHand}
          />
        </Section>

        {/* How to reach it */}
        <Section title="Contact">
          {resource.phone ? (
            // Recorded like the Call pill is: a call placed from here is the same
            // engagement, and it used to be the one call that never reached the
            // Home review prompt.
            <ContactRow
              icon="call-outline"
              text={resource.phone}
              onPress={recordAnd('called', () => callPhone(resource.phone as string))}
            />
          ) : null}
          {resource.website ? (
            <ContactRow
              icon="globe-outline"
              text={resource.website}
              onPress={() => openWebsite(resource.website as string)}
            />
          ) : null}
          {resource.address ? <ContactRow icon="location-outline" text={resource.address} /> : null}
          {resource.hours ? <ContactRow icon="time-outline" text={resource.hours} /> : null}
        </Section>

        {/* Trust */}
        {/* SourceRow already carries "· updated <date>" — no separate date line,
            it read as the same fact twice. */}
        <Section title="Trust & verification">
          <SourceRow resource={resource} size="body" />
          {warning ? (
            <AppText variant="body" style={styles.trustWarning}>
              {warning}
            </AppText>
          ) : null}
          {/* The model's own read on how far to trust the source — generated for
              exactly this section and, until now, dropped on the floor. */}
          {summary.data?.verificationNote ? (
            <AppText variant="body" color="textSecondary">
              {summary.data.verificationNote}
            </AppText>
          ) : null}
          {resource.source_url ? (
            <ContactRow
              icon="open-outline"
              text="View the source"
              onPress={() => openWebsite(resource.source_url as string)}
            />
          ) : null}
        </Section>

        <NavigatorDisclaimer />
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
      <AppText
        variant="body"
        color={onPress ? 'textPrimary' : 'textSecondary'}
        style={styles.contactText}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {text}
      </AppText>
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={text}
      onPress={onPress}
      scaleTo={pressScale.subtle}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  // Full-bleed hero: cancel the content padding (top + sides), re-inset its own
  // content, and clip the rounded bottom corners. `gap` on `content` keeps the
  // next section spaced.
  hero: {
    marginTop: -spacing.xl,
    marginHorizontal: -spacing.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    overflow: 'hidden',
  },
  heroCategory: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  section: { gap: spacing.sm },
  summaryLine: { gap: spacing.xxs },
  trustWarning: { color: colors.warningText },
  step: { flexDirection: 'row', gap: spacing.sm },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: { flex: 1, gap: spacing.xxs },
  backup: { marginTop: spacing.xs, fontStyle: 'italic' },
  // spacing.md padding keeps tappable phone/website rows at >=44pt.
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  contactText: { flex: 1 },
});
