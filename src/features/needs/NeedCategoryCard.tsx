import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, CategoryMedallion, PressableScale } from '@/components';
import { colors, spacing, surfaceTint } from '@/theme';
import { NEED_CATEGORY_META, type NeedCategory } from '@/types/need';

// A single need-category row: color-coded icon chip + label + one-line
// description + chevron. Discover's full category index ("Other"), and since
// 2026-08-05 the only place in the app that lists categories — Home's four-tile
// shortcut was removed rather than restyled, and its start card now points here.
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
      <Card style={[styles.card, { backgroundColor: surfaceTint(meta.color) }]}>
        <CategoryMedallion icon={meta.icon} color={meta.color} size={48} />
        <View style={styles.cardText}>
          <AppText variant="cardTitle">{meta.label}</AppText>
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
  cardText: { flex: 1, gap: spacing.xxs },
});
