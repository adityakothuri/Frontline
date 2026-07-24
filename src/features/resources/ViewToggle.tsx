import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components';
import { colors, radii, spacing } from '@/theme';

export type ResultsView = 'list' | 'map';

const OPTIONS: { value: ResultsView; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'list', label: 'List', icon: 'list-outline' },
  { value: 'map', label: 'Map', icon: 'map-outline' },
];

// Segmented control that flips Results between the list and the map. Both views
// render the same result set, so this only swaps presentation.
export function ViewToggle({
  value,
  onChange,
}: {
  value: ResultsView;
  onChange: (next: ResultsView) => void;
}) {
  return (
    <View style={styles.track}>
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Ionicons
              name={opt.icon}
              size={15}
              color={selected ? colors.textOnAccent : colors.textSecondary}
            />
            <AppText variant="label" color={selected ? 'textOnAccent' : 'textSecondary'}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  segmentSelected: { backgroundColor: colors.accent },
});
