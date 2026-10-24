import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

type DataRowProps = {
  label: string;
  value: string;
  /** `inline` puts a short value on the label's line (ZIP, radius); `stacked`
   *  gives a sentence its own line under the label (an AI summary field). */
  layout?: 'inline' | 'stacked';
  /** Drops the hairline under the last row of a group. */
  last?: boolean;
};

// A labelled fact: mono key, plain value, hairline below. The record format the
// resource dossier, the profile and the AI summaries all share.
export function DataRow({ label, value, layout = 'inline', last = false }: DataRowProps) {
  const inline = layout === 'inline';
  return (
    <View
      style={[styles.row, inline && styles.inline, !last && styles.divider]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <AppText variant="kicker" color="textSecondary" style={inline && styles.inlineLabel}>
        {label}
      </AppText>
      <AppText
        variant={inline ? 'bodyStrong' : 'body'}
        style={inline && styles.inlineValue}
        numberOfLines={inline ? 1 : undefined}
        ellipsizeMode="tail"
      >
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.xs },
  inline: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.lg },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  inlineLabel: { width: 112 },
  inlineValue: { flex: 1, textAlign: 'right' },
});
