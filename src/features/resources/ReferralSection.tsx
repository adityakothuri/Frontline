import { View, StyleSheet } from 'react-native';
import { AppText } from '@/components';
import { spacing } from '@/theme';
import type { NeedCategory } from '@/types/need';
import type { ResourceSearchResult } from '@/services/resources';
import { ResourceCard } from './ResourceCard';

/**
 * Statewide and national referrals (no pinpoint location), kept apart from the
 * local list so they never pose as nearby. `leads` (from
 * `splitLocalsAndReferrals()`) puts them on top when local results are thin,
 * otherwise below the list. Not labelled "by phone": some have no number.
 */
export function ReferralSection({
  referrals,
  leads,
  hasLocals,
  needCategoryFor,
}: {
  referrals: ResourceSearchResult[];
  leads: boolean;
  hasLocals: boolean;
  /** The need for each card (fixed on Results, per-row on Discover). */
  needCategoryFor: (result: ResourceSearchResult) => NeedCategory;
}) {
  if (referrals.length === 0) return null;

  return (
    <View style={styles.section}>
      <AppText variant="label" color="textSecondary" accessibilityRole="header">
        {leads ? 'Statewide & national veteran help' : 'More statewide help'}
      </AppText>
      {referrals.map((item) => (
        <ResourceCard key={item.resource.id} result={item} needCategory={needCategoryFor(item)} />
      ))}
      {leads && hasLocals ? (
        <AppText
          variant="label"
          color="textSecondary"
          accessibilityRole="header"
          style={styles.nearYouLabel}
        >
          Near you
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  nearYouLabel: { marginTop: spacing.sm },
});
