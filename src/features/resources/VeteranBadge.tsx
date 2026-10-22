import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components';
import { colors, radii, spacing } from '@/theme';
import type { VeteranRelevance } from '@/types/resource';
// paddingVertical uses spacing.xxs (2) — the sub-grid optical step.

// Why a resource belongs in a veterans' app, shown as a compact pill. Veteran
// rows get the accent pill; general rows ("Open to everyone") render muted so
// veteran resources stay visually primary — the label is honesty, not flair.
const LABEL: Record<VeteranRelevance, string> = {
  veteran_specific: 'For veterans',
  veteran_benefit: 'Veterans’ benefit',
  general: 'Open to everyone',
};

export function VeteranBadge({ relevance }: { relevance: VeteranRelevance }) {
  const general = relevance === 'general';
  return (
    <View style={[styles.badge, general && styles.badgeGeneral]}>
      <Ionicons
        name={general ? 'people-outline' : 'ribbon-outline'}
        size={12}
        color={general ? colors.textSecondary : colors.accent}
      />
      <AppText
        variant="caption"
        numberOfLines={1}
        style={general ? styles.labelGeneral : styles.label}
      >
        {LABEL[relevance]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
  },
  badgeGeneral: { backgroundColor: colors.surfaceMuted },
  label: { color: colors.accent },
  // textSecondary, not textMuted: muted is 4.24:1 on surfaceMuted — under AA
  // for 12px text. Secondary (6.0:1) still reads quieter than the accent pill.
  labelGeneral: { color: colors.textSecondary },
});
