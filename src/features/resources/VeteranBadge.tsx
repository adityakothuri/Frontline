import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components';
import { colors, radii, spacing } from '@/theme';
import type { VeteranRelevance } from '@/types/resource';

// Why a resource belongs in a veterans' app, shown as a compact pill. Every
// resource is one or the other, so the badge is a quiet reassurance (the whole
// app is veteran-relevant) rather than a filter the veteran has to think about.
const LABEL: Record<VeteranRelevance, string> = {
  veteran_specific: 'For veterans',
  veteran_benefit: 'Veterans’ benefit',
};

export function VeteranBadge({ relevance }: { relevance: VeteranRelevance }) {
  return (
    <View style={styles.badge}>
      <Ionicons name="ribbon-outline" size={12} color={colors.accent} />
      <AppText variant="caption" style={styles.label}>
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
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  label: { color: colors.accent },
});
