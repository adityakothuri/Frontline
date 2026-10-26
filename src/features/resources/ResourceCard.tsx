import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { AppText, Card, Glyph, GlyphButton, PressableScale } from '@/components';
import { formatDistance } from '@/lib/geo';
import { colors, durations, pressScale, spacing, springs } from '@/theme';
import { easings } from '@/theme/motionPresets';
import { tapSelection } from '@/lib/haptics';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { NeedCategory } from '@/types/need';
import type { ResourceSearchResult } from '@/services/resources';
import { useSaved } from '@/services/saved';
import { useReminders } from '@/services/reminders';
import { ReminderBell, confirmUnsaveWithReminder } from './ReminderBell';
import { callPhone, isOnMap, openDirections } from './resourceActions';
import { openNowStatus } from './resourceStatus';
import { StatusPill } from './StatusPill';
import { VeteranBadge } from './VeteranBadge';

type ResourceCardProps = {
  result: ResourceSearchResult;
  /** The searched need, carried to the detail page for its AI guidance. */
  needCategory: NeedCategory;
  /** When set (Results), the map action focuses the pin in place instead of
   *  navigating to the Map tab. */
  onSeeInMap?: (id: string) => void;
};

/**
 * The bookmark: saving kicks the glyph and expands one olive ring; unsaving has
 * no flourish. `burst` rests at 1 (invisible) and is reset to 0 to replay, so
 * Reduce Motion shows no ring.
 */
function SaveButton({ saved, onToggle }: { saved: boolean; onToggle: () => void }) {
  const scale = useSharedValue(1);
  const burst = useSharedValue(1);
  const wasSaved = useRef(saved);

  useEffect(() => {
    if (saved && !wasSaved.current) {
      scale.set(
        withSequence(
          withTiming(1.25, { duration: durations.micro }),
          withSpring(1, springs.settle),
        ),
      );
      burst.set(0);
      burst.set(withTiming(1, { duration: durations.base, easing: easings.out }));
    }
    wasSaved.current = saved;
  }, [saved, scale, burst]);

  const glyphStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(burst.get(), [0, 1], [0.35, 0]),
    transform: [{ scale: interpolate(burst.get(), [0, 1], [0.6, 1]) }],
  }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
      accessibilityState={{ selected: saved }}
      onPress={() => {
        tapSelection();
        onToggle();
      }}
      scaleTo={pressScale.control}
      style={styles.bookmark}
    >
      <Animated.View style={[styles.saveRing, ringStyle]} pointerEvents="none" />
      <Animated.View style={glyphStyle}>
        <Glyph
          name="bookmark"
          filled={saved}
          color={saved ? colors.accent : colors.textSecondary}
        />
      </Animated.View>
    </PressableScale>
  );
}

// One scannable result: what, how close, open status, trust, key actions; tap to open.
export function ResourceCard({ result, needCategory, onSeeInMap }: ResourceCardProps) {
  const router = useRouter();
  const { isSaved, toggleSave } = useSaved();
  const { isReminded, clearReminder } = useReminders();
  const { resource, distanceMiles, isOpenNow } = result;
  const meta = RESOURCE_CATEGORY_META[resource.category];
  const open = openNowStatus(isOpenNow, resource);
  const saved = isSaved(resource.id);
  // Open status only applies to places with visiting hours (not job postings).
  const showStatus = resource.category !== 'jobs';
  const hasDirections =
    resource.address !== null || (resource.latitude !== null && resource.longitude !== null);

  const openDetail = () =>
    router.push({
      pathname: '/resource/[id]',
      params: { id: resource.id, category: needCategory },
    });

  const seeInMap = (id: string) => {
    if (onSeeInMap) {
      onSeeInMap(id);
      return;
    }
    router.navigate({ pathname: '/map', params: { focus: id } });
  };

  return (
    // `accessible={false}`: a Pressable collapses its subtree into one VoiceOver
    // element, hiding the inner actions.
    <PressableScale accessible={false} onPress={openDetail}>
      <Card style={styles.card}>
        {/* The category's colour as a bar down the row's left edge. */}
        <View style={[styles.bar, { backgroundColor: meta.color }]} />
        <View style={styles.body}>
          <View style={styles.header}>
            <View style={styles.headerMeta}>
              <AppText variant="kicker" numberOfLines={1} style={styles.category}>
                {meta.label}
              </AppText>
              <VeteranBadge relevance={resource.veteran_relevance} />
            </View>
            {/* The reminder bell appears only once the place is saved. */}
            <View style={styles.headerActions}>
              {saved ? <ReminderBell resource={resource} /> : null}
              <SaveButton
                saved={saved}
                onToggle={() => {
                  toggleSave(resource.id);
                  if (saved && isReminded(resource.id)) {
                    confirmUnsaveWithReminder(resource.name, () => clearReminder(resource.id));
                  }
                }}
              />
            </View>
          </View>

          <AppText variant="itemTitle" numberOfLines={2} style={styles.name}>
            {resource.name}
          </AppText>

          <View style={styles.meta}>
            <AppText variant="data" color="textSecondary">
              {distanceMiles !== null
                ? formatDistance(distanceMiles)
                : isOnMap(resource)
                  ? 'Distance unknown'
                  : 'Phone / online'}
            </AppText>
            {showStatus ? <StatusPill label={open.label} tone={open.tone} /> : null}
          </View>

          <AppText variant="body" color="textSecondary" numberOfLines={2}>
            {resource.description}
          </AppText>

          {/* The detail page owns the full action set. */}
          <View style={styles.actions}>
            {resource.phone ? (
              <GlyphButton
                name="call"
                label={`Call ${resource.name}`}
                accent
                onPress={() => callPhone(resource.phone as string)}
              />
            ) : null}
            {hasDirections ? (
              <GlyphButton
                name="directions"
                label={`Directions to ${resource.name}`}
                onPress={() => openDirections(resource)}
              />
            ) : null}
            <GlyphButton
              name="map"
              label={
                isOnMap(resource)
                  ? `See ${resource.name} on the map`
                  : 'Not on the map — reach this resource by phone or online'
              }
              disabled={!isOnMap(resource)}
              onPress={() => seeInMap(resource.id)}
            />
            <View
              style={styles.detailHint}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`View details for ${resource.name}`}
            >
              <AppText variant="data" color="accent">
                Details ▸
              </AppText>
            </View>
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md },
  bar: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // flexShrink so the category label truncates before the veteran tag.
  category: { flexShrink: 1 },
  name: { textTransform: 'uppercase' },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  // Two 44pt targets sitting flush; each carries its own internal padding.
  headerActions: { flexDirection: 'row', alignItems: 'center', marginVertical: -spacing.md },
  bookmark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  saveRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  detailHint: { minHeight: 44, justifyContent: 'center', marginLeft: 'auto' },
});
