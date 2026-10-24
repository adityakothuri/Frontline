import { View, StyleSheet } from 'react-native';
import { AppText, PressableScale, SectionHeader } from '@/components';
import { colors, pressScale, spacing } from '@/theme';
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
      <View style={styles.row}>
        {/* The trust hue lives in the square; the words stay in secondary ink. */}
        <View style={styles.trust}>
          <View style={[styles.square, { backgroundColor: color }]} />
          <AppText variant="kicker" color="textSecondary">
            {SOURCE_TRUST_LABELS[source.trust]}
          </AppText>
        </View>
        <AppText variant="bodyStrong">{source.title}</AppText>
        <AppText variant="body" color="textSecondary" numberOfLines={2}>
          {source.description}
        </AppText>
        <AppText variant="data" color="accent">
          {`${source.sourceName} ▸`}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // `gap: sm` between heading and list, the same rhythm the detail page's and the
  // profile form's sections keep.
  wrap: { marginTop: spacing.xl, gap: spacing.sm },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  trust: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  square: { width: 8, height: 8 },
});
