import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Skeleton } from '@/components';
import { colors, radii, shadows, spacing, surfaceTint, withAlpha } from '@/theme';

type AiContentBlockProps = {
  /** Optional heading; omit when a surrounding section already titles the block. */
  title?: string;
  /** The hue of the category this guidance is about (from `*_CATEGORY_META`), so
   *  the block belongs to the resource it sits under. Falls back to the olive
   *  accent where there's no category context. */
  color?: string;
  loading?: boolean;
  children?: ReactNode;
};

// Presentational chrome that sets AI output visibly apart from official/source
// text, so guidance is never mistaken for the source. It owns no data — the
// caller loads content and passes it (or `loading`) in. The "AI-generated" tag
// is the block's one label; the longer not-advice disclaimer is deliberately
// not repeated per block.
//
// The surface is washed with the category hue so the guidance belongs to the
// resource it sits under — but deliberately at HALF the detail hero's strength
// (0.07 vs 0.14), because at equal strength the block became indistinguishable
// from the hero and "is this the source or the model?" stopped being visible.
// The sparkles glyph and the shadow stay constant across categories: they, not
// the hue, are what says "this is AI".
export function AiContentBlock({
  title,
  color = colors.accent,
  loading = false,
  children,
}: AiContentBlockProps) {
  return (
    <View
      style={[
        styles.block,
        {
          backgroundColor: surfaceTint(color, 0.07, colors.background),
          borderColor: withAlpha(color, 0.45),
        },
      ]}
    >
      {title ? (
        <View style={styles.header}>
          <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
          <AppText variant="heading" style={styles.title}>
            {title}
          </AppText>
        </View>
      ) : null}
      <AppText variant="caption" color="textSecondary" style={styles.tag}>
        AI-generated — verify with the source
      </AppText>

      {loading ? (
        <View
          style={styles.loading}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Generating…"
        >
          <Skeleton width="45%" />
          <Skeleton />
          <Skeleton width="80%" />
        </View>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radii.lg,
    // A category-tinted fill + border set AI guidance apart as a distinct,
    // "intelligent" surface — not just another neutral card — and tie it to the
    // resource above it. Both colors are applied inline from the `color` prop.
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { flexShrink: 1 },
  tag: { marginBottom: spacing.xs },
  loading: { minHeight: 72, justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
  body: { gap: spacing.sm, marginTop: spacing.xs },
});
