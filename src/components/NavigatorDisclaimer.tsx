import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

const NAVIGATOR_TEXT =
  'Frontline helps you find resources. It is not the VA or a government agency. Always confirm details with the official source.';

// The product-wide navigator disclaimer; one component owns the copy so screens
// cannot drift. `text` lets AI surfaces pass `AI_NOT_ADVICE_DISCLAIMER` instead.
export function NavigatorDisclaimer({
  text = NAVIGATOR_TEXT,
  style,
}: {
  text?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.row, style]}>
      <AppText variant="caption" color="textSecondary" style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  // A fine-print block: hairline above, like the notes at the foot of a form.
  row: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  text: { flex: 1 },
});
