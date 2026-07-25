import { ScrollView, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale } from '@/components';
import { colors, radii, spacing, withAlpha } from '@/theme';
import { NEED_CATEGORY_META, type NeedCategory } from '@/types/need';

// The Discover shell row. A curated handful of the most-common needs, plus two
// sentinels: `all` (browse everything) and `other` (open the full category list).
export type ShellId = 'all' | 'essentials' | 'va' | 'jobs' | 'other';

type IconName = keyof typeof Ionicons.glyphMap;
type Shell = { id: ShellId; label: string; icon: IconName; category?: NeedCategory };

const SHELLS: Shell[] = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'essentials', label: 'Essentials', icon: 'basket-outline', category: 'essentials' },
  { id: 'va', label: 'VA Help', icon: 'document-text-outline', category: 'general_benefits' },
  { id: 'jobs', label: 'Employment', icon: 'briefcase-outline', category: 'jobs' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

/** The need category a shell filters to, or undefined for `all`/`other`. */
export function shellCategory(id: ShellId): NeedCategory | undefined {
  return SHELLS.find((s) => s.id === id)?.category;
}

// A shell chip keeps its category icon even when selected (so the row stays
// recognizable) and, when active, wears its own category hue as a soft tint +
// border — `all`/`other` fall back to the olive accent.
function ShellChip({
  shell,
  selected,
  onPress,
}: {
  shell: Shell;
  selected: boolean;
  onPress: () => void;
}) {
  const hue = shell.category ? NEED_CATEGORY_META[shell.category].color : colors.accent;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={shell.label}
      onPress={onPress}
      scaleTo={0.96}
    >
      <View
        style={[
          styles.chip,
          selected ? { backgroundColor: withAlpha(hue, 0.16), borderColor: hue } : styles.chipRest,
        ]}
      >
        <Ionicons name={shell.icon} size={16} color={selected ? hue : colors.textSecondary} />
        <AppText variant="label" color={selected ? 'textPrimary' : 'textSecondary'}>
          {shell.label}
        </AppText>
      </View>
    </PressableScale>
  );
}

export function CategoryShells({
  selected,
  onSelect,
}: {
  selected: ShellId;
  onSelect: (id: ShellId) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {SHELLS.map((shell) => (
        <ShellChip
          key={shell.id}
          shell={shell}
          selected={shell.id === selected}
          onPress={() => onSelect(shell.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexGrow:0 keeps the row its natural height — without it the horizontal
  // ScrollView stretches vertically and the chips balloon on re-render.
  scroll: { flexGrow: 0 },
  row: {
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipRest: { backgroundColor: colors.surface, borderColor: colors.border },
});
