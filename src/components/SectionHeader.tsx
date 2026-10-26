import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '@/theme';
import { AppText } from './AppText';

type SectionHeaderProps = {
  title: string;
  /** Section number on a page that reads in order: `01  NEAR YOU`. */
  number?: number;
  /** One line under the title, for a section that needs framing. */
  caption?: string;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, number, caption, style }: SectionHeaderProps) {
  return (
    <View style={[styles.root, style]}>
      <View style={styles.titleRow}>
        {number !== undefined ? (
          <AppText variant="kicker" color="textSecondary" accessibilityElementsHidden>
            {String(number).padStart(2, '0')}
          </AppText>
        ) : null}
        {/* The header trait sits on the text: on iOS a bare View is not an
            accessibility element, so a role on it is lost. */}
        <AppText variant="kicker" style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {caption ? (
        <AppText variant="caption" color="textSecondary">
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  title: { flexShrink: 1 },
});
