import { useEffect, useRef } from 'react';
import { Animated, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, CategoryMedallion, PrimaryButton } from '@/components';
import { formatDistance } from '@/lib/geo';
import { colors, spacing, surfaceTint } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { NeedCategory } from '@/types/need';
import type { ResourceSearchResult } from '@/services/resources';
import { openNowStatus } from './resourceStatus';
import { SourceRow } from './SourceRow';
import { StatusPill } from './StatusPill';

type ResourcePreviewProps = {
  result: ResourceSearchResult;
  needCategory: NeedCategory;
  onClose: () => void;
};

// The compact card that floats over the map when a pin is tapped: just enough to
// recognize the resource, then a tap through to the full detail page.
export function ResourcePreview({ result, needCategory, onClose }: ResourcePreviewProps) {
  const router = useRouter();
  const { resource, distanceMiles, isOpenNow } = result;
  const meta = RESOURCE_CATEGORY_META[resource.category];
  const open = openNowStatus(isOpenNow);
  // No visiting hours for a job posting → skip the open-now pill.
  const showStatus = resource.category !== 'jobs';

  // Spring up + fade in when a pin is tapped, so the card doesn't just snap in.
  // Respects reduce-motion (snaps in instead).
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      anim.setValue(1);
      return;
    }
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }).start();
  }, [anim, reduced]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }}
    >
      <Card style={[styles.card, { backgroundColor: surfaceTint(meta.color) }]}>
      <View style={styles.topRow}>
        <CategoryMedallion icon={meta.icon} color={meta.color} size={38} />
        <AppText variant="caption" color="textSecondary" style={styles.category} numberOfLines={1}>
          {meta.label}
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Close preview" onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <AppText variant="subtitle">{resource.name}</AppText>

      <View style={styles.metaRow}>
        <AppText variant="caption" color="textMuted">
          {distanceMiles !== null ? formatDistance(distanceMiles) : 'Phone / online'}
        </AppText>
        {showStatus ? <StatusPill label={open.label} tone={open.tone} /> : null}
      </View>

      <SourceRow resource={resource} />

      <PrimaryButton
        label="View details"
        variant="secondary"
        onPress={() =>
          router.push({ pathname: '/resource/[id]', params: { id: resource.id, category: needCategory } })
        }
        style={styles.cta}
      />
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  category: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cta: { minHeight: 44, marginTop: spacing.xs },
});
