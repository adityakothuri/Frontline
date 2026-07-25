import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, CategoryMedallion, PressableScale } from '@/components';
import { formatDistance } from '@/lib/geo';
import { colors, radii, spacing, surfaceTint } from '@/theme';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { NeedCategory } from '@/types/need';
import type { ResourceSearchResult } from '@/services/resources';
import { useSaved } from '@/services/saved';
import { callPhone, openDirections } from './resourceActions';
import { openNowStatus } from './resourceStatus';
import { SeeInMapButton } from './SeeInMapButton';
import { SourceRow } from './SourceRow';
import { StatusPill } from './StatusPill';
import { VeteranBadge } from './VeteranBadge';

type IoniconName = keyof typeof Ionicons.glyphMap;

type ResourceCardProps = {
  result: ResourceSearchResult;
  /** The need category the veteran searched — carried to the detail page so its
   *  AI guidance keeps the same context. */
  needCategory: NeedCategory;
  /** When set (Results screen), "See in map" focuses the pin in-place instead of
   *  navigating to the Map tab. Omitted in Discover/Saved, which have no map view. */
  onSeeInMap?: (id: string) => void;
};

// The scannable unit of the results list: what it is, how close, whether it's
// open, how trustworthy the info is, the two actions that matter most, and a tap
// anywhere else to open the full detail page.
export function ResourceCard({ result, needCategory, onSeeInMap }: ResourceCardProps) {
  const router = useRouter();
  const { isSaved, toggleSave } = useSaved();
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
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`View details for ${resource.name}`}
      onPress={openDetail}
    >
      <Card style={[styles.card, { backgroundColor: surfaceTint(meta.color) }]}>
        <View style={styles.header}>
          <CategoryMedallion icon={meta.icon} color={meta.color} size={44} />
          <View style={styles.headerText}>
            <View style={styles.metaRow}>
              <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.category}>
                {meta.label}
              </AppText>
              <VeteranBadge relevance={resource.veteran_relevance} />
            </View>
            <AppText variant="subtitle" numberOfLines={2}>
              {resource.name}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
            onPress={() => toggleSave(resource.id)}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.bookmarkPressed}
          >
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={saved ? colors.accent : colors.textMuted}
            />
          </Pressable>
        </View>

        <View style={styles.subMeta}>
          <AppText variant="caption" color="textMuted">
            {distanceMiles !== null ? formatDistance(distanceMiles) : 'Phone / online'}
          </AppText>
          {showStatus ? <StatusPill label={open.label} tone={open.tone} /> : null}
        </View>

        <AppText variant="body" color="textSecondary" numberOfLines={2} style={styles.desc}>
          {resource.description}
        </AppText>

        <SourceRow resource={resource} style={styles.sourceRow} />

        <View style={styles.divider} />

        <View style={styles.actions}>
          {resource.phone ? (
            <ActionButton
              icon="call-outline"
              label="Call"
              onPress={() => callPhone(resource.phone as string)}
            />
          ) : null}
          {hasDirections ? (
            <ActionButton
              icon="navigate-outline"
              label="Directions"
              onPress={() => openDirections(resource)}
            />
          ) : null}
          <SeeInMapButton resource={resource} variant="card" onPress={seeInMap} />
          <View style={styles.detailHint}>
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

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Ionicons name={icon} size={16} color={colors.accent} />
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  // Medallion + a text column (category label · veteran badge, then the name),
  // with the bookmark pinned top-right. The medallion + the whisper card tint
  // are what make each category read as its own — not a colored rail.
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xxs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // flexShrink so the (longest, variable) category label truncates before the
  // fixed veteran badge, keeping the row on one line without overlap.
  category: { flexShrink: 1 },
  subMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bookmarkPressed: { opacity: 0.5 },
  desc: { marginTop: spacing.xxs },
  sourceRow: { marginTop: spacing.xxs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: spacing.xs },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  actionPressed: { opacity: 0.7 },
  detailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
});
