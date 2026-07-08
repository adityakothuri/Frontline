import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card } from '@/components';
import { formatDistance } from '@/lib/geo';
import { colors, radii, spacing } from '@/theme';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { ResourceSearchResult } from '@/services/resources';
import { callPhone, openDirections } from './resourceActions';
import { openNowStatus, sourceStatus, type StatusTone } from './resourceStatus';

type IoniconName = keyof typeof Ionicons.glyphMap;

const TONE_COLOR: Record<StatusTone, string> = {
  success: colors.success,
  warning: colors.warning,
  muted: colors.textMuted,
};

type ResourceCardProps = {
  result: ResourceSearchResult;
};

// The scannable unit of the results list: what it is, how close, whether it's
// open, how trustworthy the info is, and the two actions that matter most.
export function ResourceCard({ result }: ResourceCardProps) {
  const { resource, distanceMiles, isOpenNow } = result;
  const meta = RESOURCE_CATEGORY_META[resource.category];
  const open = openNowStatus(isOpenNow);
  const source = sourceStatus(resource);
  const hasDirections =
    resource.address !== null || (resource.latitude !== null && resource.longitude !== null);

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.categoryChip}>
          <Ionicons name={meta.icon} size={14} color={colors.accent} />
          <AppText variant="caption" color="textSecondary">
            {meta.label}
          </AppText>
        </View>
        <StatusPill label={open.label} tone={open.tone} />
      </View>

      <AppText variant="subtitle" style={styles.name}>
        {resource.name}
      </AppText>

      <AppText variant="caption" color="textMuted">
        {distanceMiles !== null ? formatDistance(distanceMiles) : 'Phone / online'}
      </AppText>

      <AppText variant="body" color="textSecondary" numberOfLines={2} style={styles.desc}>
        {resource.description}
      </AppText>

      <View style={styles.sourceRow}>
        <Ionicons
          name={source.tone === 'success' ? 'shield-checkmark-outline' : 'alert-circle-outline'}
          size={13}
          color={TONE_COLOR[source.tone]}
        />
        <AppText variant="caption" style={{ color: TONE_COLOR[source.tone] }}>
          {source.label}
        </AppText>
      </View>

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
      </View>
    </Card>
  );
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: TONE_COLOR[tone] }]} />
      <AppText variant="caption" style={{ color: TONE_COLOR[tone] }}>
        {label}
      </AppText>
    </View>
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
      <Ionicons name={icon} size={16} color={colors.textPrimary} />
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: radii.pill },
  name: { marginTop: spacing.xs },
  desc: { marginTop: spacing.xs },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
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
});
