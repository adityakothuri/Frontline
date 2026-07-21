import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components';
import { spacing } from '@/theme';
import type { Resource } from '@/types/resource';
import { sourceStatus, STATUS_TONE_COLOR } from './resourceStatus';

type SourceRowProps = {
  resource: Resource;
  /** `caption` for the card and map preview; `body` for the detail page. */
  size?: 'caption' | 'body';
  style?: StyleProp<ViewStyle>;
};

// The trust badge row — source type plus checked/outdated — shared by the card,
// the map preview, and the detail page so the treatment can't drift. Tone color
// is always paired with the label text, never color alone.
export function SourceRow({ resource, size = 'caption', style }: SourceRowProps) {
  const source = sourceStatus(resource);
  const color = STATUS_TONE_COLOR[source.tone];
  return (
    <View style={[styles.row, style]}>
      <Ionicons
        name={source.tone === 'success' ? 'shield-checkmark-outline' : 'alert-circle-outline'}
        size={size === 'body' ? 15 : 13}
        color={color}
      />
      <AppText variant={size} style={[styles.label, { color }]}>
        {source.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // Long labels ("Community-submitted · may be outdated") wrap, never overflow.
  label: { flexShrink: 1 },
});
