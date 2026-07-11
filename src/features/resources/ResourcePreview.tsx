import { useEffect, useRef } from 'react';
import { Animated, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, PrimaryButton } from '@/components';
import { formatDistance } from '@/lib/geo';
import { colors, spacing } from '@/theme';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { NeedCategory } from '@/types/need';
import type { ResourceSearchResult } from '@/services/resources';
import { openNowStatus } from './resourceStatus';
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

  // Spring up + fade in when a pin is tapped, so the card doesn't just snap in.
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }}
    >
      <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.categoryChip}>
          <Ionicons name={meta.icon} size={14} color={meta.color} />
          <AppText variant="caption" color="textSecondary">
            {meta.label}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close preview" onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <AppText variant="subtitle">{resource.name}</AppText>

      <View style={styles.metaRow}>
        <AppText variant="caption" color="textMuted">
          {distanceMiles !== null ? formatDistance(distanceMiles) : 'Phone / online'}
        </AppText>
        <StatusPill label={open.label} tone={open.tone} />
      </View>

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
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cta: { minHeight: 44, marginTop: spacing.xs },
});
