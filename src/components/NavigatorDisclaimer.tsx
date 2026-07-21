import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

// The product-wide navigator disclaimer required by Trust, Safety & Privacy.
// One component owns the copy so Home, Results, and the detail page can never
// drift apart. Quiet by design — informative, not alarmist.
export function NavigatorDisclaimer({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <Ionicons
        name="information-circle-outline"
        size={14}
        color={colors.textMuted}
        style={styles.icon}
      />
      <AppText variant="caption" color="textMuted" style={styles.text}>
        Frontline helps you find resources. It is not the VA or a government agency. Always
        confirm details with the official source.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  // Optically align the icon with the first line of the caption.
  icon: { marginTop: 1 },
  text: { flex: 1 },
});
