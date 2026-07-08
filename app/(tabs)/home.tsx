import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, ScreenContainer, ScreenHeader } from '@/components';
import { colors, radii, spacing } from '@/theme';
import { NEED_CATEGORIES, NEED_CATEGORY_META, type NeedCategory } from '@/types/need';

// The front door. "What do you need help with?" → a category → the guided flow.
export default function HomeScreen() {
  const router = useRouter();

  const openCategory = (category: NeedCategory) => {
    router.push({ pathname: '/need/[category]', params: { category } });
  };

  return (
    <ScreenContainer scroll>
      <ScreenHeader
        title="What do you need help with?"
        subtitle="Choose a category to find nearby veteran resources and your next steps."
      />
      <View style={styles.grid}>
        {NEED_CATEGORIES.map((category) => (
          <CategoryTile
            key={category}
            category={category}
            onPress={() => openCategory(category)}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

function CategoryTile({
  category,
  onPress,
}: {
  category: NeedCategory;
  onPress: () => void;
}) {
  const meta = NEED_CATEGORY_META[category];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={meta.icon} size={22} color={colors.accent} />
      </View>
      <AppText variant="bodyStrong">{meta.label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    // Two columns: just under half-width so the row gap fits.
    width: '48%',
    flexGrow: 1,
    minHeight: 108,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
  },
  tilePressed: { backgroundColor: colors.surfaceMuted },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
});
