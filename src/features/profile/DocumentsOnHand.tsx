import { View, StyleSheet } from 'react-native';
import { AppText, Glyph } from '@/components';
import { colors, spacing } from '@/theme';
import { DOCUMENT_OPTIONS, type VeteranDocument } from '@/types/need';

// Every document Frontline knows about, ticked or not. The gaps are the useful
// part: a veteran who can see "DD-214 —" knows what to dig out before a visit,
// which a summary like "Veteran ID +1 more" never told them.
export function DocumentsOnHand({ held }: { held: VeteranDocument[] }) {
  return (
    <View>
      {DOCUMENT_OPTIONS.map(({ value, label }, i) => {
        const has = held.includes(value);
        const last = i === DOCUMENT_OPTIONS.length - 1;
        return (
          <View
            key={value}
            style={[styles.row, !last && styles.divider]}
            accessible
            accessibilityLabel={`${label}, ${has ? 'on hand' : 'not on hand'}`}
          >
            <View style={styles.mark}>
              {has ? (
                <Glyph name="check" size={18} />
              ) : (
                <AppText variant="data" color="textSecondary">
                  —
                </AppText>
              )}
            </View>
            <AppText
              variant={has ? 'bodyStrong' : 'body'}
              color={has ? 'textPrimary' : 'textSecondary'}
            >
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  mark: { width: 20, alignItems: 'center' },
});
