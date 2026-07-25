import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, ScrollView, Pressable, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, CategoryMedallion, NavigatorDisclaimer } from '@/components';
import { colors, radii, spacing, surfaceTint } from '@/theme';
import { isOpenNow } from '@/lib/hours';
import { useProfile } from '@/services/profile';
import { useActivity } from '@/services/activity';
import { aiService, type BenefitSummary, type NextStepPlan } from '@/services/ai';
import { RESOURCE_CATEGORY_META, type Resource } from '@/types/resource';
import { defaultNeedForCategory, type NeedCategory } from '@/types/need';
import { callPhone, openDirections } from './resourceActions';
import { openNowStatus, trustWarning } from './resourceStatus';
import { SourceRow } from './SourceRow';
import { StatusPill } from './StatusPill';
import { ActionRow } from './ActionRow';
import { AiContentBlock } from './AiContentBlock';
import { DocumentChecklist } from './DocumentChecklist';
import { CallScriptSheet } from './CallScriptSheet';
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
  const need = useMemo(
    () => defaultNeedForCategory(needCategory, profile?.zip, profile?.preferredRadiusMiles),
    [needCategory, profile?.zip, profile?.preferredRadiusMiles],
  );

  const [summary, setSummary] = useState<BenefitSummary | null>(null);
  const [plan, setPlan] = useState<NextStepPlan | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  // Bumped by the retry tap to re-run the AI effect.
  const [aiAttempt, setAiAttempt] = useState(0);
  const [scriptOpen, setScriptOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setSummary(null);
    setPlan(null);
    setAiFailed(false);
    Promise.all([
      aiService.summarizeBenefit({ resource }),
      aiService.buildNextStepPlan({ need, resource }),
    ])
      .then(([s, p]) => {
        if (!active) return;
        setSummary(s);
        setPlan(p);
      })
      .catch(() => {
        // A real AI proxy can fail — offer a retry instead of skeletons forever.
        if (active) setAiFailed(true);
      });
    return () => {
      active = false;
    };
    // Reload only when the resource changes (or a retry is requested).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id, aiAttempt]);

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
        {/* Category hero — a soft header zone in the category's own hue behind a
            large medallion, so every resource type opens with a distinct,
            premium identity. Full-bleed under the nav header. */}
        <View style={[styles.hero, { backgroundColor: surfaceTint(meta.color, 0.14) }]}>
          <CategoryMedallion icon={meta.icon} color={meta.color} size={60} />
          <AppText variant="label" color="textSecondary" style={styles.heroCategory}>
            {meta.label}
          </AppText>
          <AppText variant="title">{resource.name}</AppText>
          <View style={styles.headerMeta}>
            {showStatus ? <StatusPill label={open.label} tone={open.tone} /> : null}
          </View>
          {/* Real community rating (0 until veterans vote), never simulated */}
          <ResourceRating resourceId={resource.id} />
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

        {/* AI guidance failed (real proxy later) — one retry for both blocks */}
        {aiFailed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading the guidance again"
            onPress={() => setAiAttempt((n) => n + 1)}
            style={({ pressed }) => [styles.aiRetry, pressed && styles.pressed]}
          >
            <AppText variant="body" color="danger">
              Couldn’t load the guidance.
            </AppText>
            <AppText variant="label" color="accentPressed">
              Tap to try again
            </AppText>
          </Pressable>
        ) : (
          <>
            {/* What it is */}
            <AiContentBlock title="Summary" loading={!summary}>
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
            <AiContentBlock title="Your next steps" loading={!plan}>
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
          </>
        )}

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
        {/* SourceRow already carries "· updated <date>" — no separate date line,
            it read as the same fact twice. */}
        <Section title="Trust & verification">
          <SourceRow resource={resource} size="body" />
          {warning ? (
            <AppText variant="body" style={styles.trustWarning}>
              {warning}
            </AppText>
          ) : null}
          {resource.source_url ? (
            <ContactRow icon="open-outline" text="View the source" onPress={() => Linking.openURL(resource.source_url as string)} />
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
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  // Full-bleed hero: cancel the content padding (top + sides), re-inset its own
  // content, and clip the gradient. `gap` on `content` keeps the next section spaced.
  hero: {
    marginTop: -spacing.xl,
    marginHorizontal: -spacing.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    overflow: 'hidden',
  },
  heroCategory: { marginTop: spacing.xs },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  section: { gap: spacing.sm },
  summaryLine: { gap: spacing.xxs },
  trustWarning: { color: colors.warningText },
  aiRetry: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  step: { flexDirection: 'row', gap: spacing.sm },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: { flex: 1, gap: spacing.xxs },
  backup: { marginTop: spacing.xs, fontStyle: 'italic' },
  // spacing.md padding keeps tappable phone/website rows at >=44pt.
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  contactText: { flex: 1 },
  pressed: { opacity: 0.6 },
});
