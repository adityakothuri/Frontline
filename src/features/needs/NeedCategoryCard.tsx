import { View, StyleSheet } from 'react-native';
import { AppText, PressableScale } from '@/components';
import { colors, spacing } from '@/theme';
import { NEED_CATEGORY_META, type NeedCategory } from '@/types/need';

// One entry in Discover's full category index ("Other"): the category's bar,
// its name, one line of description, and ▸. The only place in the app that
// lists every category.
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
      style={styles.row}
    >
      <View style={[styles.bar, { backgroundColor: meta.color }]} />
      <View style={styles.text}>
        <AppText variant="itemTitle" style={styles.name}>
          {meta.label}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {meta.description}
        </AppText>
      </View>
      <AppText variant="data" color="textSecondary">
        ▸
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bar: { width: 4, alignSelf: 'stretch' },
  text: { flex: 1, gap: spacing.xxs },
  name: { textTransform: 'uppercase' },
});
