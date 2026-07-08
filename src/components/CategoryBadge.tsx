import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii, spacing } from '@/theme';
import {
  categoryMeta,
  severityColor,
  severitySoftColor,
  type AlertCategory,
  type AlertSeverity,
} from '@/mock/alerts';
import { AppText } from './AppText';

type CategoryBadgeProps = {
  category: AlertCategory;
  severity: AlertSeverity;
};

// A compact category + severity chip: soft severity-tinted background, the category
// icon, and its label. Reused in the alerts list rows and the detail sheet.
export function CategoryBadge({ category, severity }: CategoryBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors[severitySoftColor[severity]] },
      ]}
    >
      <Ionicons
        name={categoryMeta[category].icon}
        size={14}
        color={colors[severityColor[severity]]}
      />
      <AppText variant="label" color={severityColor[severity]}>
        {categoryMeta[category].label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
});
