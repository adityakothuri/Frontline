import { View, Linking, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, Card, PressableScale } from '@/components';
import { colors, radii, spacing, withAlpha } from '@/theme';
import type { NeedCategory } from '@/types/need';
import {
  officialSourcesFor,
  SOURCE_TRUST_COLORS,
  SOURCE_TRUST_LABELS,
  type OfficialSource,
} from '@/data/officialSources';

// A supporting widget on the category page — trusted online backups (official
// forms, guidance, next steps) beneath the local opportunity finder, never in
// place of it.
export function OfficialSourcesWidget({ category }: { category: NeedCategory }) {
  const sources = officialSourcesFor(category);
  if (sources.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
        <AppText variant="subtitle">Official online sources</AppText>
      </View>
      <AppText variant="caption" color="textMuted" style={styles.note}>
        Trusted backup — official forms, guidance, and next steps when local help isn’t enough.
      </AppText>

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
      onPress={() => Linking.openURL(source.url)}
      scaleTo={0.985}
    >
      <Card style={styles.card}>
        <View style={styles.topRow}>
          <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.14) }]}>
            <Ionicons name="shield-checkmark" size={11} color={color} />
            <AppText variant="caption" style={{ color }}>
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
  wrap: { marginTop: spacing.xl, gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  note: { marginBottom: spacing.sm },
  list: { gap: spacing.md },
  card: { gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  title: { marginTop: spacing.xs },
  desc: { marginTop: 2 },
});
