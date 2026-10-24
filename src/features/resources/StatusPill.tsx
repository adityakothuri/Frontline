import { View, StyleSheet } from 'react-native';
import { AppText } from '@/components';
import { spacing } from '@/theme';
import { STATUS_TONE_COLOR, type StatusTone } from './resourceStatus';

// A small square plus a mono label for a status tone (open now, hours unknown).
// Never colour alone — the square always travels with its words.
export function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const color = STATUS_TONE_COLOR[tone];
  return (
    <View style={styles.row}>
      <View style={[styles.square, { backgroundColor: color }]} />
      <AppText variant="data" style={{ color }} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  square: { width: 7, height: 7 },
});
