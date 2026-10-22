import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, CategoryMedallion, PressableScale } from '@/components';
import { formatDistance } from '@/lib/geo';
import { colors, pressScale, shadows, spacing, stagger, surfaceTint } from '@/theme';
import { settleIn, sinkOut } from '@/theme/motionPresets';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { NeedCategory } from '@/types/need';
import type { ResourceSearchResult } from '@/services/resources';
import { useActivity } from '@/services/activity';
import { useSaved } from '@/services/saved';
import { ActionPill } from './ActionPill';
import { callPhone, openDirections } from './resourceActions';
import { openNowStatus } from './resourceStatus';
import { SourceRow } from './SourceRow';
import { StatusPill } from './StatusPill';

type ResourcePreviewProps = {
  result: ResourceSearchResult;
  needCategory: NeedCategory;
  onClose: () => void;
};

// The compact card that floats over the map when a pin is tapped: enough to
// recognize the resource, act on it, or tap through to the full detail page.
//
// The actions matter here more than they look like they should. Someone reading
// a map is usually deciding *where to go next*, and the answer is almost always
// "call ahead" or "drive there" — so making them pass through a detail page for
// either was an extra screen between a veteran and the phone call.
export function ResourcePreview({ result, needCategory, onClose }: ResourcePreviewProps) {
  const router = useRouter();
  const { recordEngagement } = useActivity();
  const { isSaved, toggleSave } = useSaved();
  const { resource, distanceMiles, isOpenNow } = result;
  const meta = RESOURCE_CATEGORY_META[resource.category];
  const open = openNowStatus(isOpenNow);
  // No visiting hours for a job posting → skip the open-now pill.
  const showStatus = resource.category !== 'jobs';
  const saved = isSaved(resource.id);
  const hasDirections =
    resource.address !== null || (resource.latitude !== null && resource.longitude !== null);

  // Same bookkeeping the detail page does, so calling from the map still counts
  // as engaging with a resource and can be asked about later.
  const recordAnd = (action: 'called' | 'directions', run: () => void) => () => {
    recordEngagement({
      resourceId: resource.id,
      resourceName: resource.name,
      category: resource.category,
      action,
    });
    run();
  };

  // Springs up when a pin is tapped and sinks back down when it is dismissed, so
  // the card is thrown by the tap rather than blinking in and out. Reduce Motion
  // is handled by the library: both animations resolve straight to their end
  // state.
  //
  // One `stagger.step` behind the pin, which is the same beat a screen's sections
  // arrive on. Starting together read as two unrelated things happening at the
  // moment of a tap — the pin blooming up on the map and a card arriving from the
  // bottom edge — rather than as one causing the other.
  const openDetail = () =>
    router.push({
      pathname: '/resource/[id]',
      params: { id: resource.id, category: needCategory },
    });

  return (
    <Animated.View entering={settleIn().delay(stagger.step)} exiting={sinkOut()}>
      {/* The whole card opens the detail page, with a `View details ›` hint rather
          than a full-width button. That button was the visually heaviest control
          in the card — heavier than Call — which inverted the hierarchy on a
          screen where calling and driving are the jobs and browsing is not. Same
          pattern as ResourceCard. */}
      {/* `accessible={false}`, as on `ResourceCard`: the pills inside must stay
          individually reachable; the hint at the foot is the accessible target. */}
      <PressableScale accessible={false} onPress={openDetail}>
        <Card style={[styles.card, { backgroundColor: surfaceTint(meta.color) }, shadows.md]}>
          <View style={styles.topRow}>
            <CategoryMedallion icon={meta.icon} color={meta.color} size={38} />
            <AppText
              variant="caption"
              color="textSecondary"
              style={styles.category}
              numberOfLines={1}
            >
              {meta.label}
            </AppText>
            {/* Real 44x44 geometry, no hitSlop — a 20pt glyph with hitSlop came to
                ~36pt, under the minimum every other control in the app meets. */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              onPress={onClose}
              scaleTo={pressScale.control}
              containerStyle={styles.close}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </PressableScale>
          </View>

          {/* Clamped: a long facility name would otherwise grow the floating card
              until it covered the map it is describing. */}
          <AppText variant="cardTitle" numberOfLines={2}>
            {resource.name}
          </AppText>

          <View style={styles.metaRow}>
            {/* textSecondary, not textMuted: on the category-tinted card, muted
                lands at 4.45:1 for four of the eleven hues. ResourceCard records
                the same correction for the same reason. */}
            <AppText variant="caption" color="textSecondary">
              {distanceMiles !== null ? formatDistance(distanceMiles) : 'Phone / online'}
            </AppText>
            {showStatus ? <StatusPill label={open.label} tone={open.tone} /> : null}
          </View>

          <SourceRow resource={resource} />

          <View style={styles.actions}>
            {resource.phone ? (
              <ActionPill
                icon="call"
                label="Call"
                primary
                onPress={recordAnd('called', () => callPhone(resource.phone as string))}
              />
            ) : null}
            {hasDirections ? (
              <ActionPill
                icon="navigate-outline"
                label="Directions"
                onPress={recordAnd('directions', () => openDirections(resource))}
              />
            ) : null}
            <ActionPill
              icon={saved ? 'bookmark' : 'bookmark-outline'}
              label={saved ? 'Saved' : 'Save'}
              active={saved}
              selected={saved}
              onPress={() => toggleSave(resource.id)}
            />
          </View>

          {/* Not a button: the card itself is the target. This is the affordance
              that says so. */}
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
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  category: { flex: 1 },
  // Negative margins so the 44pt target doesn't add 44pt of row height: the glyph
  // stays optically where it was, the reachable area is the full square.
  close: {
    width: 44,
    height: 44,
    marginTop: -spacing.md,
    marginBottom: -spacing.md,
    marginRight: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // The card's own `gap` sets the rhythm; no extra off-grid nudges on top of it.
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xxs,
  },
});
