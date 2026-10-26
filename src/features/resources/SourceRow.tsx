import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components';
import { spacing } from '@/theme';
import type { Resource } from '@/types/resource';
import { sourceStatus, STATUS_TONE_COLOR } from './resourceStatus';

type SourceRowProps = {
  resource: Resource;
  /** `caption` for card and map preview; `body` for the detail page. */
  size?: 'caption' | 'body';
  style?: StyleProp<ViewStyle>;
};

// The trust line — source type plus checked/outdated — shared by the card, the
// map preview and the detail page. Tone colour always travels with its words.
export function SourceRow({ resource, size = 'caption', style }: SourceRowProps) {
  const source = sourceStatus(resource);
  const color = STATUS_TONE_COLOR[source.tone];
  return (
    <View style={[styles.row, style]}>
      <View
        style={[styles.square, size === 'body' && styles.squareBody, { backgroundColor: color }]}
      />
      <AppText variant={size === 'body' ? 'body' : 'data'} style={[styles.label, { color }]}>
        {source.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  // flex-start: when a long label wraps, the mark stays on the first line.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  // Long labels ("Community-submitted · may be outdated") wrap, never overflow.
  label: { flexShrink: 1 },
  // Centred on the first text line (18pt data / 24pt body).
  square: { width: 7, height: 7, marginTop: 5.5 },
  squareBody: { marginTop: 8.5 },
});
