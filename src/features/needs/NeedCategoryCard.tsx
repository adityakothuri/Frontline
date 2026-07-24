import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, PressableScale } from '@/components';
import { colors, radii, spacing, withAlpha } from '@/theme';
import { NEED_CATEGORY_META, type NeedCategory } from '@/types/need';

// A single need-category row: color-coded icon chip + label + one-line
// description + chevron. One source of truth for the Home and Discover lists.
export function NeedCategoryCard({
  category,
  onPress,
}: {
  category: NeedCategory;
  onPress: () => void;
}) {
  const meta = NEED_CATEGORY_META[category];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={meta.label}
      accessibilityHint={meta.description}
      onPress={onPress}
    >
      <Card style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: withAlpha(meta.color, 0.16) }]}>
          <Ionicons name={meta.icon} size={24} color={meta.color} />
        </View>
        <View style={styles.cardText}>
          <AppText variant="subtitle">{meta.label}</AppText>
          <AppText variant="caption" color="textSecondary">
            {meta.description}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
});
