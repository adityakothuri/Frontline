import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, CategoryMedallion, PressableScale, Skeleton } from '@/components';
import { colors, durations, pressScale, radii, rise, spacing, stagger, timings } from '@/theme';
import { riseIn } from '@/theme/motionPresets';
import { tapSelection } from '@/lib/haptics';
import { browseCountCap, resourceService, resourceToNeedCategory } from '@/services/resources';
import { reportDataError } from '@/services/monitoring';
import { NEED_CATEGORIES, NEED_CATEGORY_META, type NeedCategory } from '@/types/need';

/** How many categories the strip shows. Four fits a phone's width at the
 *  medallion size below without the row scrolling, which is the point: this is a
 *  glance, and a glance does not scroll. */
const SHOWN = 4;

/**
 * `capped` is true when one of the need's resource categories reached a browse
 * cap (the per-category limit, or the lower dense-general cap on food, housing,
 * healthcare and clothing) — the count is then a floor, and the strip says
 * "20+", never "20". The caps exist so Discover's interleaved feed does not
 * fetch everything; this strip rides on that same query and must not dress a
 * cap up as a count.
 */
type Glance = {
  total: number;
  capped: boolean;
  top: { category: NeedCategory; count: number; capped: boolean }[];
};

/** "20+" when a browse cap was reached, else the count. */
const countLabel = (count: number, capped: boolean) => (capped ? `${count}+` : `${count}`);

/**
 * What is actually near this veteran, on the front door.
 *
 * Home used to end at the start card and, on a fresh install, half a screen of
 * bare paper — which a veteran read as a page that had failed to load. The 2×2
 * grid that once sat here was removed for a good reason: four fixed tiles carried
 * no information a veteran could act on. This block passes that same test. The
 * count is live (and honest: a category at a browse cap reads "20+"), the
 * categories are the ones that *exist* near their ZIP, and a tap lands on the
 * results for that need.
 *
 * It also pre-warms the browse. The query is byte-for-byte the one Discover and
 * Map issue (`listResources(undefined, zip, radius)`), and the resource cache
 * dedupes on the body — so opening Home pays for the fetch once, and the two tabs
 * that used to show a shield on first open now paint from memory.
 *
 * Quiet by design: nothing is drawn until the data lands, a skeleton appears only
 * past the loading quiet window, and a failure draws nothing at all. Home is not
 * the place to apologise for a network; Discover and Map own the error states.
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
  // The skeleton waits out the same quiet window the shield does, so a cached
  // browse — the common case after the first launch — never flashes a placeholder.
  const [quietOver, setQuietOver] = useState(false);

  useEffect(() => {
    if (!enabled || !zip) return;
    let active = true;
    setStatus('loading');
    // Reset per fetch, or a ZIP change would swap a live card for a skeleton even
    // when the cache answers within a frame.
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
    return `${n} ${glance.total === 1 ? 'place' : 'places'} within ${radiusMiles} miles`;
  }, [glance, radiusMiles]);

  if (!enabled || !zip || status === 'failed') return null;
  if (status === 'loading' || !glance) {
    return quietOver ? <GlanceSkeleton /> : null;
  }
  if (glance.total === 0) return null;

  return (
    // Its own reveal rather than a beat in Home's entrance: it is data-gated, so
    // it arrives when the browse lands, not on a timer.
    // The section gap below rides on the rendered branch only, so an empty
    // glance costs the page nothing and a rendered one never sits flush against
    // the review deck beneath it.
    <Animated.View entering={riseIn(0, rise.md).duration(durations.reveal)} style={styles.root}>
      <Card style={styles.card}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${label} of ${zip}. Opens the map.`}
          onPress={() => router.navigate('/map')}
          scaleTo={pressScale.subtle}
          style={styles.heading}
        >
          <View style={styles.headingText}>
            <AppText variant="caption" color="textSecondary">
              Near {zip}
            </AppText>
            <AppText variant="subtitle">{label}</AppText>
          </View>
          <View style={styles.mapHint}>
            <Ionicons name="map-outline" size={16} color={colors.textSecondary} />
            <AppText variant="label" color="textSecondary">
              Map
            </AppText>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </View>
        </PressableScale>

        <View style={styles.row}>
          {glance.top.map(({ category, count, capped }, i) => {
            const meta = NEED_CATEGORY_META[category];
            const shown = countLabel(count, capped);
            return (
              <Animated.View
                key={category}
                entering={riseIn(stagger.step * (i + 1), rise.sm)}
                style={styles.cell}
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`${meta.label}, ${capped ? 'more than ' : ''}${count} ${count === 1 ? 'place' : 'places'} nearby`}
                  onPress={() => {
                    tapSelection();
                    router.push({ pathname: '/results', params: { category } });
                  }}
                  scaleTo={pressScale.chip}
                  style={styles.cellInner}
                >
                  <CategoryMedallion icon={meta.icon} color={meta.color} size={40} />
                  {/* The count sits under the medallion, where every cell is the
                      same height, and the name comes last: it is the one thing
                      in the cell that may take two lines (a 71pt cell cannot
                      hold "Transportation" on one), so any slack falls below it
                      where nothing follows rather than opening a hole between
                      the name and its number. */}
                  <AppText variant="label">{shown}</AppText>
                  <AppText
                    variant="caption"
                    color="textSecondary"
                    numberOfLines={2}
                    style={styles.cellLabel}
                  >
                    {meta.shortLabel ?? meta.label}
                  </AppText>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      </Card>
    </Animated.View>
  );
}

/**
 * Located rows only, grouped by the *need* a veteran would tap — several resource
 * categories fold into one need (food and clothing are both Essentials), and the
 * results screen is keyed by need. The strip shows the `SHOWN` largest, in the
 * canonical order rather than by size, so the row does not reshuffle between
 * ZIP codes.
 */
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
  const largest = new Set(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, SHOWN)
      .map(([category]) => category),
  );
  const top = NEED_CATEGORIES.filter((c) => largest.has(c)).map((category) => ({
    category,
    count: counts.get(category) as number,
    capped: cappedNeeds.has(category),
  }));
  return { total, capped: cappedNeeds.size > 0, top };
}

function GlanceSkeleton() {
  return (
    // Bars sized to the real line boxes (16pt caption, 22pt subtitle, 40pt
    // medallion, 36pt two-line label, 16pt count), so the swap to content does
    // not shove the deck and the crisis row down the page.
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Finding help near you"
      style={styles.root}
    >
      <Card style={styles.card}>
        <View style={styles.headingText}>
          <Skeleton width={72} height={16} />
          <Skeleton width="60%" height={22} delay={stagger.pulse} />
        </View>
        <View style={styles.row}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.cell, styles.cellInner]}>
              <Skeleton width={40} height={40} borderRadius={radii.md} delay={stagger.pulse * i} />
              <Skeleton width={24} height={18} delay={stagger.pulse * i} />
              <Skeleton width={56} height={16} delay={stagger.pulse * i} />
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: spacing.xl },
  card: { gap: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headingText: { flex: 1, gap: spacing.xxs },
  mapHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1 },
  cellInner: { alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  cellLabel: { textAlign: 'center' },
});
