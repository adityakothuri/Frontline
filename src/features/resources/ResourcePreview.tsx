import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Card, Glyph, PressableScale } from '@/components';
import { formatDistance } from '@/lib/geo';
import { colors, pressScale, spacing, swatchStyle } from '@/theme';
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

// The compact card over the map when a pin is tapped: recognise the place, call
// or get directions directly, or tap through to the detail page. Its motion is
// owned by the wrapper in `ResourceMap`.
export function ResourcePreview({ result, needCategory, onClose }: ResourcePreviewProps) {
  const router = useRouter();
  const { recordEngagement } = useActivity();
  const { isSaved, toggleSave } = useSaved();
  const { resource, distanceMiles, isOpenNow } = result;
  const meta = RESOURCE_CATEGORY_META[resource.category];
  const open = openNowStatus(isOpenNow, resource);
  // No visiting hours for a job posting → skip the open-now pill.
  const showStatus = resource.category !== 'jobs';
  const saved = isSaved(resource.id);
  const hasDirections =
    resource.address !== null || (resource.latitude !== null && resource.longitude !== null);

  // Recorded as engagements, like the detail page, for the Home review prompt.
  const recordAnd = (action: 'called' | 'directions', run: () => void) => () => {
    recordEngagement({
      resourceId: resource.id,
      resourceName: resource.name,
      category: resource.category,
      action,
    });
    run();
  };

  const openDetail = () =>
    router.push({
      pathname: '/resource/[id]',
      params: { id: resource.id, category: needCategory },
    });

  // The whole card opens the detail page; a quiet `Details ▸` hint keeps Call the
  // strongest control. `accessible={false}` keeps the pills individually
  // reachable; the hint is the accessible target.
  return (
    <PressableScale accessible={false} onPress={openDetail}>
      <Card variant="panel">
        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={swatchStyle(meta.color)} />
            <AppText variant="kicker" style={styles.category} numberOfLines={1}>
              {meta.label}
            </AppText>
            {/* Real 44x44 geometry rather than hitSlop. */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              onPress={onClose}
              scaleTo={pressScale.control}
              containerStyle={styles.close}
            >
              <Glyph name="close" color={colors.textPrimary} />
            </PressableScale>
          </View>

          {/* Clamped so a long name cannot grow the card over the map. */}
          <AppText variant="itemTitle" numberOfLines={2}>
            {resource.name}
          </AppText>

          <View style={styles.metaRow}>
            <AppText variant="data" color="textSecondary">
              {distanceMiles !== null ? formatDistance(distanceMiles) : 'Phone / online'}
            </AppText>
            {showStatus ? <StatusPill label={open.label} tone={open.tone} /> : null}
          </View>

          <SourceRow resource={resource} />

          <View style={styles.actions}>
            {resource.phone ? (
              <ActionPill
                label="Call"
                primary
                onPress={recordAnd('called', () => callPhone(resource.phone as string))}
              />
            ) : null}
            {hasDirections ? (
              <ActionPill
                label="Directions"
                onPress={recordAnd('directions', () => openDirections(resource))}
              />
            ) : null}
            <ActionPill
              label={saved ? 'Saved' : 'Save'}
              active={saved}
              selected={saved}
              onPress={() => toggleSave(resource.id)}
            />
          </View>

          {/* Affordance only: the card itself is the press target. */}
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
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  category: { flex: 1 },
  // Negative margins so the 44pt target adds no row height.
  close: {
    width: 44,
    height: 44,
    marginTop: -spacing.md,
    marginBottom: -spacing.md,
    marginRight: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detailHint: { alignSelf: 'flex-end' },
});
