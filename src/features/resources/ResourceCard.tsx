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
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, CategoryMedallion, PressableScale } from '@/components';
import { formatDistance } from '@/lib/geo';
import { colors, durations, pressScale, radii, spacing, springs, surfaceTint } from '@/theme';
import { easings } from '@/theme/motionPresets';
import { tapSelection } from '@/lib/haptics';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { NeedCategory } from '@/types/need';
import type { ResourceSearchResult } from '@/services/resources';
import { useSaved } from '@/services/saved';
import { useReminders } from '@/services/reminders';
import { ActionPill } from './ActionPill';
import { ReminderBell, confirmUnsaveWithReminder } from './ReminderBell';
import { callPhone, openDirections } from './resourceActions';
import { openNowStatus } from './resourceStatus';
import { SeeInMapButton } from './SeeInMapButton';
import { SourceRow } from './SourceRow';
import { StatusPill } from './StatusPill';
import { VeteranBadge } from './VeteranBadge';

type ResourceCardProps = {
  result: ResourceSearchResult;
  /** The need category the veteran searched — carried to the detail page so its
   *  AI guidance keeps the same context. */
  needCategory: NeedCategory;
  /** When set (Results screen), "See in map" focuses the pin in-place instead of
   *  navigating to the Map tab. Omitted in Discover/Saved, which have no map view. */
  onSeeInMap?: (id: string) => void;
};

/**
 * The bookmark, and the small celebration for saving something.
 *
 * The glyph that changed is the thing that animates — it kicks up and settles,
 * and one olive ring expands out of it and fades. Nothing is added to the card's
 * resting state: the ring only exists for the ~240ms it is travelling. Removing
 * a save gets no flourish, because undoing something is not an achievement.
 *
 * `burst` rests at 1 (the finished, invisible frame) and is knocked back to 0 to
 * replay, which also means Reduce Motion — where Reanimated jumps straight to
 * the target — correctly shows no ring at all.
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
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={18}
          color={saved ? colors.accent : colors.textMuted}
        />
      </Animated.View>
    </PressableScale>
  );
}

// The scannable unit of the results list: what it is, how close, whether it's
// open, how trustworthy the info is, the two actions that matter most, and a tap
// anywhere else to open the full detail page.
export function ResourceCard({ result, needCategory, onSeeInMap }: ResourceCardProps) {
  const router = useRouter();
  const { isSaved, toggleSave } = useSaved();
  const { isReminded, clearReminder } = useReminders();
  const { resource, distanceMiles, isOpenNow } = result;
  const meta = RESOURCE_CATEGORY_META[resource.category];
  const open = openNowStatus(isOpenNow);
  const saved = isSaved(resource.id);
  // "Open now / hours unknown" only makes sense for places you visit during
  // hours. A job posting has no visiting hours, so the pill would just be noise.
  const showStatus = resource.category !== 'jobs';
  const hasDirections =
    resource.address !== null || (resource.latitude !== null && resource.longitude !== null);

  const openDetail = () =>
    router.push({
      pathname: '/resource/[id]',
      params: { id: resource.id, category: needCategory },
    });

  // Results passes onSeeInMap to focus the pin in its own map view; elsewhere
  // (Discover/Saved) we switch to the Map tab and focus it there via ?focus=.
  const seeInMap = (id: string) => {
    if (onSeeInMap) {
      onSeeInMap(id);
      return;
    }
    router.navigate({ pathname: '/map', params: { focus: id } });
  };

  return (
    // `accessible={false}` on the outer target: a `Pressable` is accessible by
    // default and collapses its subtree into one VoiceOver element, which made
    // Call, Directions, See in map and the bookmark unreachable individually.
    // The "View details" hint below is the card's own accessible target instead.
    <PressableScale accessible={false} onPress={openDetail}>
      <Card style={[styles.card, { backgroundColor: surfaceTint(meta.color) }]}>
        <View style={styles.header}>
          <CategoryMedallion icon={meta.icon} color={meta.color} size={44} />
          <View style={styles.headerMeta}>
            <AppText
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              style={styles.category}
            >
              {meta.label}
            </AppText>
            <VeteranBadge relevance={resource.veteran_relevance} />
          </View>
          {/* The bell only joins the bookmark once the place is saved — that is
              the moment the veteran has said they intend to come back to it,
              and Saved is where every armed reminder is managed. */}
          <View style={styles.headerActions}>
            {saved ? <ReminderBell resource={resource} shape="icon" /> : null}
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

        <AppText variant="cardTitle" numberOfLines={2} style={styles.name}>
          {resource.name}
        </AppText>

        <View style={styles.subMeta}>
          {/* textSecondary (not muted) so small text keeps AA on the tinted card. */}
          <AppText variant="caption" color="textSecondary">
            {distanceMiles !== null ? formatDistance(distanceMiles) : 'Phone / online'}
          </AppText>
          {showStatus ? <StatusPill label={open.label} tone={open.tone} /> : null}
        </View>

        <AppText variant="body" color="textSecondary" numberOfLines={2} style={styles.desc}>
          {resource.description}
        </AppText>

        <SourceRow resource={resource} style={styles.sourceRow} />

        <View style={styles.divider} />

        {/* The same `ActionPill` the detail page and the map preview use. The
            card had its own 34pt rectangle version — under the 44pt floor, and a
            second shape for the same action. Quiet rather than `primary` here on
            purpose: a filled olive Call on every card in a list is a column of
            primary actions; the detail page, which is about one place, gets the
            filled one. */}
        <View style={styles.actions}>
          {resource.phone ? (
            <ActionPill
              icon="call-outline"
              label="Call"
              onPress={() => callPhone(resource.phone as string)}
            />
          ) : null}
          {hasDirections ? (
            <ActionPill
              icon="navigate-outline"
              label="Directions"
              onPress={() => openDirections(resource)}
            />
          ) : null}
          <SeeInMapButton resource={resource} variant="card" onPress={seeInMap} />
          <View
            style={styles.detailHint}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`View details for ${resource.name}`}
          >
            <AppText variant="label" color="textSecondary">
              View details
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  // A single header row: medallion · (category label + veteran badge) · bookmark.
  // The name and everything below stay flush to the card's left edge, so the
  // medallion + whisper tint carry the category identity without indenting the
  // content (not a colored rail).
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // flexShrink so the (longest, variable) category label truncates before the
  // fixed veteran badge, keeping the row on one line without overlap.
  category: { flexShrink: 1 },
  name: { marginTop: spacing.xs },
  subMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // A real 44pt target. It used to be an 18pt glyph with hitSlop, which came to
  // ~34pt — under the minimum every other control in the app meets.
  // The two 44pt targets sit flush: both already carry their own internal
  // padding, so a gap here would push the cluster into the title.
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  bookmark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  saveRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  desc: { marginTop: spacing.xxs },
  sourceRow: { marginTop: spacing.xxs },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  detailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
});
