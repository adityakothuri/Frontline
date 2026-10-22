import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, PressableScale, SectionHeader } from '@/components';
import { colors, pressScale, radii, spacing, withAlpha } from '@/theme';
import type { NeedCategory } from '@/types/need';
import {
  officialSourcesFor,
  SOURCE_TRUST_COLORS,
  SOURCE_TRUST_LABELS,
  type OfficialSource,
} from '@/data/officialSources';
import { openWebsite } from './resourceActions';

// A supporting widget on the category page — trusted online backups (official
// forms, guidance, next steps) beneath the local opportunity finder, never in
// place of it.
export function OfficialSourcesWidget({ category }: { category: NeedCategory }) {
  const sources = officialSourcesFor(category);
  if (sources.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <SectionHeader
        size="label"
        icon="shield-checkmark-outline"
        title="Official online sources"
        caption="Trusted backup — official forms, guidance, and next steps when local help isn’t enough."
      />

      <View style={styles.list}>
        {sources.map((source) => (
          <SourceCard key={source.url} source={source} />
        ))}
      </View>
    </View>
  );
}

function SourceCard({ source }: { source: OfficialSource }) {
  const color = SOURCE_TRUST_COLORS[source.trust];
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${source.title}. ${SOURCE_TRUST_LABELS[source.trust]}. Opens ${source.sourceName}.`}
      onPress={() => openWebsite(source.url)}
      scaleTo={pressScale.subtle}
    >
      <Card style={styles.card}>
        <View style={styles.topRow}>
          {/* The hue lives in the glyph and the wash; the words stay in secondary
              ink. A category hue is never small text — none of them clears AA at
              12px, and the design system says so. */}
          <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.14) }]}>
            <Ionicons name="shield-checkmark" size={11} color={color} />
            <AppText variant="caption" color="textSecondary">
              {SOURCE_TRUST_LABELS[source.trust]}
            </AppText>
          </View>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </View>

        <AppText variant="bodyStrong" style={styles.title}>
          {source.title}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {source.sourceName}
        </AppText>
        <AppText variant="body" color="textSecondary" numberOfLines={2} style={styles.desc}>
          {source.description}
        </AppText>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // `gap: sm` between heading and list, the same rhythm the detail page's and the
  // profile form's sections keep.
  wrap: { marginTop: spacing.xl, gap: spacing.sm },
  list: { gap: spacing.md },
  card: { gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  title: { marginTop: spacing.xs },
  desc: { marginTop: spacing.xxs },
});
