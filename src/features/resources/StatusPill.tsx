import { View, StyleSheet } from 'react-native';
import { AppText } from '@/components';
import { radii, spacing } from '@/theme';
import { STATUS_TONE_COLOR, type StatusTone } from './resourceStatus';

// A small dot + label that reads a status tone (open-now on the card and the
// detail header). Never color alone — the dot is always paired with its label.
export function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const color = STATUS_TONE_COLOR[tone];
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="caption" style={{ color }} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: radii.sm },
});
