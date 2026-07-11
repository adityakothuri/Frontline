import { ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Chip } from '@/components';
import { spacing } from '@/theme';
import type { NeedCategory } from '@/types/need';

// The Discover shell row. A curated handful of the most-common needs, plus two
// sentinels: `all` (browse everything) and `other` (open the full category list).
export type ShellId = 'all' | 'food' | 'clothes' | 'va' | 'jobs' | 'other';

type IconName = keyof typeof Ionicons.glyphMap;
type Shell = { id: ShellId; label: string; icon: IconName; category?: NeedCategory };

const SHELLS: Shell[] = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'food', label: 'Food', icon: 'fast-food-outline', category: 'food' },
  { id: 'clothes', label: 'Clothes', icon: 'shirt-outline', category: 'clothing' },
  { id: 'va', label: 'VA Help', icon: 'document-text-outline', category: 'general_benefits' },
  { id: 'jobs', label: 'Employment', icon: 'briefcase-outline', category: 'jobs' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

/** The need category a shell filters to, or undefined for `all`/`other`. */
export function shellCategory(id: ShellId): NeedCategory | undefined {
  return SHELLS.find((s) => s.id === id)?.category;
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
        <Chip
          key={shell.id}
          label={shell.label}
          icon={shell.icon}
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
});
