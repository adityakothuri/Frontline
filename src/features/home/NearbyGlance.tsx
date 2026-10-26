import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { AppText, PressableScale, SectionHeader, Skeleton, TextAction } from '@/components';
import { colors, durations, pressScale, spacing, stagger, swatchStyle, timings } from '@/theme';
import { fadeIn } from '@/theme/motionPresets';
import { tapSelection } from '@/lib/haptics';
import { browseCountCap, resourceService, resourceToNeedCategory } from '@/services/resources';
import { reportDataError } from '@/services/monitoring';
import { NEED_CATEGORIES, NEED_CATEGORY_META, type NeedCategory } from '@/types/need';

/** `capped`: a resource category hit its browse cap, so the count is a floor
 *  and shows as "20+", never "20". */
type Glance = {
  total: number;
  capped: boolean;
  top: { category: NeedCategory; count: number; capped: boolean }[];
};

/** "20+" when a browse cap was reached, else the count. */
const countLabel = (count: number, capped: boolean) => (capped ? `${count}+` : `${count}`);

/**
 * Home's live summary of what is near the veteran's ZIP; each row opens results
 * for that need.
 *
 * Uses the exact query Discover and Map issue, so the shared cache lets those
 * tabs paint from memory. Quiet by design: nothing until data lands, a skeleton
 * only after the quiet window, and nothing on failure (other tabs own errors).
 */
export function NearbyGlance({
  zip,
  radiusMiles,
  enabled,
}: {
  zip?: string;
  radiusMiles: number;
  /** The profile has hydrated. Before that there is no ZIP to search from. */
  enabled: boolean;
}) {
  const router = useRouter();
  const [glance, setGlance] = useState<Glance | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  // Waits out the loading quiet window so a cached browse never flashes a skeleton.
  const [quietOver, setQuietOver] = useState(false);

  useEffect(() => {
    if (!enabled || !zip) return;
    let active = true;
    setStatus('loading');
    // Reset per fetch so a ZIP change answered from cache does not flash a skeleton.
    setQuietOver(false);
    const quiet = setTimeout(() => setQuietOver(true), timings.loadingQuiet);
    resourceService
      .listResources(undefined, zip, radiusMiles)
      .then((results) => {
        if (!active) return;
        setGlance(
          summarise(
            results.map((r) => ({
              category: r.resource.category,
              located: r.distanceMiles !== null,
            })),
          ),
        );
        setStatus('ready');
      })
      .catch((error) => {
        reportDataError('Home nearby', error);
        if (active) setStatus('failed');
      });
    return () => {
      active = false;
      clearTimeout(quiet);
    };
  }, [enabled, zip, radiusMiles]);

  const label = useMemo(() => {
    if (!glance) return '';
    const n = countLabel(glance.total, glance.capped);
    return `${n} ${glance.total === 1 ? 'place' : 'places'} within ${radiusMiles} mi`;
  }, [glance, radiusMiles]);

  if (!enabled || !zip || status === 'failed') return null;
  if (status === 'loading' || !glance) {
    return quietOver ? <GlanceSkeleton /> : null;
  }
  if (glance.total === 0) return null;

  return (
    // Its own reveal: it is data-gated, so it arrives when the browse lands.
    <Animated.View entering={fadeIn(0, durations.reveal)} style={styles.root}>
      <View style={styles.heading}>
        <SectionHeader title={`Near ${zip}`} style={styles.headingTitle} />
        <TextAction
          label="Map"
          accessibilityHint={`${label} of ${zip}. Opens the map.`}
          onPress={() => router.navigate('/map')}
        />
      </View>
      <AppText variant="data" color="textSecondary">
        {label}
      </AppText>

      <View style={styles.list}>
        {glance.top.map(({ category, count, capped }) => {
          const meta = NEED_CATEGORY_META[category];
          return (
            <PressableScale
              key={category}
              accessibilityRole="button"
              accessibilityLabel={`${meta.label}, ${capped ? 'more than ' : ''}${count} ${count === 1 ? 'place' : 'places'} nearby`}
              onPress={() => {
                tapSelection();
                router.push({ pathname: '/results', params: { category } });
              }}
              scaleTo={pressScale.subtle}
              style={styles.row}
            >
              <View style={swatchStyle(meta.color)} />
              <AppText variant="data">{meta.shortLabel ?? meta.label}</AppText>
              {/* Dot leaders, clipped to the remaining width. */}
              <AppText
                variant="data"
                color="textSecondary"
                numberOfLines={1}
                ellipsizeMode="clip"
                style={styles.leader}
                accessibilityElementsHidden
              >
                {LEADER}
              </AppText>
              <AppText variant="data">{countLabel(count, capped)}</AppText>
            </PressableScale>
          );
        })}
      </View>
    </Animated.View>
  );
}

const LEADER = ' .'.repeat(80);

/** How many categories Home lists — a glance, not a directory. */
const SHOWN = 5;

/** Located rows grouped by need (several resource categories fold into one),
 *  largest `SHOWN` first. */
function summarise(
  rows: { category: Parameters<typeof resourceToNeedCategory>[0]; located: boolean }[],
): Glance {
  const counts = new Map<NeedCategory, number>();
  // Tallied per *resource* category, because that is what the browse caps.
  const perResource = new Map<string, number>();
  const cappedNeeds = new Set<NeedCategory>();
  let total = 0;
  for (const row of rows) {
    if (!row.located) continue;
    total += 1;
    const need = resourceToNeedCategory(row.category);
    counts.set(need, (counts.get(need) ?? 0) + 1);
    const n = (perResource.get(row.category) ?? 0) + 1;
    perResource.set(row.category, n);
    if (n >= browseCountCap(row.category)) cappedNeeds.add(need);
  }
  // Most places first; ties keep the canonical order so the list is stable.
  const top = NEED_CATEGORIES.filter((c) => counts.has(c))
    .map((category) => ({
      category,
      count: counts.get(category) as number,
      capped: cappedNeeds.has(category),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, SHOWN);
  return { total, capped: cappedNeeds.size > 0, top };
}

function GlanceSkeleton() {
  return (
    // Bars sized to the real line boxes so content swaps in without a jump.
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Finding help near you"
      style={styles.root}
    >
      <Skeleton width={120} height={16} />
      <Skeleton width="50%" height={18} delay={stagger.pulse} />
      <View style={styles.list}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.row}>
            <Skeleton width="100%" height={18} delay={stagger.pulse * i} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: spacing.xl, gap: spacing.xs },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headingTitle: { flex: 1 },
  list: {
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  leader: { flex: 1 },
});
