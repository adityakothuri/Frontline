import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Skeleton } from '@/components';
import { colors, radii, shadows, spacing, withAlpha } from '@/theme';

type AiContentBlockProps = {
  /** Optional heading; omit when a surrounding section already titles the block. */
  title?: string;
  loading?: boolean;
  children?: ReactNode;
};

// Presentational chrome that sets AI output visibly apart from official/source
// text, so guidance is never mistaken for the source. It owns no data — the
// caller loads content and passes it (or `loading`) in. The "AI-generated" tag
// is the block's one label; the longer not-advice disclaimer is deliberately
// not repeated per block.
export function AiContentBlock({ title, loading = false, children }: AiContentBlockProps) {
  return (
    <View style={styles.block}>
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
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    // An accent-tinted border + soft lift set AI guidance apart as a distinct,
    // "intelligent" surface — not just another neutral card.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(colors.accent, 0.25),
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
