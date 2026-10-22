import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

type SectionHeaderProps = {
  title: string;
  /** A small glyph before the title. Secondary ink, never olive — a heading is
   *  not an action, and olive owns actions. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** One quiet line under the title, for a section that needs framing. */
  caption?: string;
  /** `heading` for a page's own sections (the resource detail); `subtitle` for
   *  groups inside a form or a widget. */
  size?: 'heading' | 'label';
  style?: StyleProp<ViewStyle>;
};

// The one section heading. It replaced three local `Section` helpers — on the
// detail page, the profile form and the official-sources widget — that agreed on
// almost everything and drifted on the rest (icon colour, variant, gap).
export function SectionHeader({
  title,
  icon,
  caption,
  size = 'heading',
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.root, style]}>
      <View style={styles.titleRow}>
        {icon ? <Ionicons name={icon} size={16} color={colors.textSecondary} /> : null}
        {/* The heading trait on the text itself — on iOS a role only attaches to
            an accessibility element, and a bare View is not one. */}
        <AppText variant={size} style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {caption ? (
        <AppText variant="caption" color="textMuted">
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
});
