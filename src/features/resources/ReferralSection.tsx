import { View, StyleSheet } from 'react-native';
import { AppText } from '@/components';
import { spacing } from '@/theme';
import type { NeedCategory } from '@/types/need';
import type { ResourceSearchResult } from '@/services/resources';
import { ResourceCard } from './ResourceCard';

/**
 * Statewide and national veteran referrals — resources with no pinpoint (SSVF
 * providers serving whole counties, crisis and benefit hotlines), rendered apart
 * from the local list so they never pose as somewhere nearby.
 *
 * `leads` decides both placement and framing, and the caller supplies it from
 * `splitLocalsAndReferrals()`. When local results are thin these are the answer,
 * so they sit on top under "Statewide & national veteran help" with a "Near you"
 * divider beneath. Otherwise they're backup and sit below the list under "More
 * statewide help" — a veteran with real options nearby should see those first.
 * (Not "by phone": a handful of SSVF grantees have no phone number at all.)
 *
 * Both Results and Discover previously carried their own copy of this markup,
 * which is how the placement rule drifted apart from the decision that set it.
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
  /** Screens scope cards differently: Results knows its need, Discover derives
   *  one per row from the resource's category. */
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
