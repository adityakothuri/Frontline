import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Animated,
  Easing,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, ErrorState, Loading, LocationButton, Skeleton } from '@/components';
import { colors, radii, shadows, spacing, withAlpha } from '@/theme';
import { resourceService, type ResourceSearchResult } from '@/services/resources';
import { useProfile } from '@/services/profile';
import { ResourceMap } from '@/features/resources/ResourceMap';
import { RESOURCE_CATEGORY_META, type ResourceCategory } from '@/types/resource';
import { DEFAULT_RADIUS_MILES } from '@/types/need';

type MapState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; results: ResourceSearchResult[] };

// The dedicated Map tab: every located opportunity as a category pin, one tap
// from anywhere. The map sits in a framed card between a header + category
// legend and an olive status pill; the whole screen staggers in on entry and
// the legend/map/count fade in together once results land.
export default function MapScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [state, setState] = useState<MapState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Arriving from a "See in map" tap elsewhere: focus that pin. ResourceMap
  // glides to it once results are loaded (its own effect keys off selectedId).
  useEffect(() => {
    if (typeof focus === 'string' && focus.length > 0) setSelectedId(focus);
  }, [focus]);

  // Bumped by the error state's Retry so the fetch effect re-runs on demand.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((n) => n + 1);

  const zip = profile?.zip;
  const radiusMiles = profile?.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES;

  useEffect(() => {
    // `active` guards against out-of-order resolution: editing the ZIP twice in
    // quick succession must not let the older response overwrite the newer one.
    let active = true;
    setState({ status: 'loading' });
    resourceService
      .listResources(undefined, zip, radiusMiles)
      .then((results) => {
        if (active) setState({ status: 'ready', results });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [zip, radiusMiles, reloadToken]);

  // One driver staggers the scaffolding in on mount; a second reveals the
  // loaded content (legend, map, count) when results arrive. Both respect
  // the system reduce-motion setting, matching the onboarding pattern.
  const [enter] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(0));
  const reduceMotion = useRef(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      reduceMotion.current = reduce;
      if (reduce) {
        enter.setValue(1);
      } else {
        Animated.timing(enter, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
    return () => {
      active = false;
    };
  }, [enter]);

  useEffect(() => {
    if (state.status !== 'ready') {
      reveal.setValue(0);
      return;
    }
    if (reduceMotion.current) {
      reveal.setValue(1);
    } else {
      Animated.timing(reveal, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [state.status, reveal]);

  const slice = (from: number, to: number) => ({
    opacity: enter.interpolate({ inputRange: [from, to], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [from, to],
          outputRange: [16, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  });
  const revealStyle = {
    opacity: reveal,
    transform: [
      { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
    ],
  };

  // Which categories are pinned, most common first — feeds the legend + count.
  const legend = useMemo(() => {
    if (state.status !== 'ready') return [];
    const counts = new Map<ResourceCategory, number>();
    for (const { resource } of state.results) {
      if (resource.latitude === null || resource.longitude === null) continue;
      counts.set(resource.category, (counts.get(resource.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));
  }, [state]);
  const pinned = legend.reduce((sum, item) => sum + item.count, 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <LocationButton zip={profile?.zip} onPress={() => router.navigate('/profile')} />
      </View>

      <Animated.View style={[styles.header, slice(0, 0.5)]}>
        <AppText variant="title">Map</AppText>
        <AppText variant="body" color="textSecondary" style={styles.subtitle}>
          Nearby resources, pinned by category.
        </AppText>
      </Animated.View>

      {/* Legend: what the pin colors mean. Skeleton pills while loading so the
          row doesn't jump in later. */}
      <View style={styles.legendArea}>
        {state.status === 'ready' ? (
          <Animated.View style={revealStyle}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.legendRow}
            >
              {legend.map(({ category, count }) => {
                const meta = RESOURCE_CATEGORY_META[category];
                return (
                  <View
                    key={category}
                    style={[styles.legendPill, { backgroundColor: withAlpha(meta.color, 0.14) }]}
                  >
                    <Ionicons name={meta.icon} size={13} color={meta.color} />
                    <AppText variant="caption" color="textSecondary">
                      {meta.label}
                    </AppText>
                    {/* The count stays textSecondary, not the category hue: at
                        12px on a wash of that same hue it only reached ~3:1,
                        well under AA. The icon already carries the color. */}
                    <AppText variant="caption" color="textSecondary">
                      {count}
                    </AppText>
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        ) : state.status === 'loading' ? (
          <View style={[styles.legendRow, styles.legendSkeleton]}>
            <Skeleton width={96} height={28} borderRadius={radii.pill} />
            <Skeleton width={112} height={28} borderRadius={radii.pill} />
            <Skeleton width={88} height={28} borderRadius={radii.pill} />
          </View>
        ) : null}
      </View>

      <Animated.View style={[styles.mapFrame, slice(0.2, 0.75)]}>
        {state.status === 'loading' ? (
          <Loading label="Loading the map…" />
        ) : state.status === 'error' ? (
          <ErrorState onRetry={reload} />
        ) : (
          <Animated.View style={[styles.mapFill, { opacity: reveal }]}>
            <ResourceMap results={state.results} selectedId={selectedId} onSelect={setSelectedId} />
          </Animated.View>
        )}
      </Animated.View>

      <Animated.View style={[styles.footerArea, slice(0.45, 1)]}>
        {state.status === 'ready' ? (
          <Animated.View style={[styles.footerPill, revealStyle]}>
            <Ionicons name="location" size={14} color={colors.accent} />
            <AppText
              variant="label"
              color="accentPressed"
              numberOfLines={1}
              style={styles.footerPillText}
            >
              {pinned} {pinned === 1 ? 'place' : 'places'} nearby — tap a pin to preview
            </AppText>
          </Animated.View>
        ) : (
          <AppText variant="caption" color="textMuted">
            {state.status === 'loading' ? 'Finding resources near you…' : ' '}
          </AppText>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  subtitle: { marginTop: spacing.sm },
  // Reserve the legend's height so it never reflows the map when it loads in;
  // minHeight (not a fixed height) lets the pills grow instead of clipping under
  // large Dynamic Type.
  legendArea: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.sm },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  legendSkeleton: { opacity: 0.7 },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs + spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  // The map lives in a rounded frame with the app's card treatment — clear
  // margins and a whisper of shadow so it lifts off the paper.
  mapFrame: {
    flex: 1,
    marginHorizontal: spacing.xl,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    ...shadows.md,
  },
  mapFill: { flex: 1 },
  footerArea: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  footerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '100%',
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + spacing.xxs,
    paddingHorizontal: spacing.lg,
  },
  // flexShrink lets the label truncate inside the pill instead of overflowing
  // the screen when the place count / copy is long.
  footerPillText: { flexShrink: 1 },
});
