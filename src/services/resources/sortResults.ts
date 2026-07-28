import type { Urgency } from '@/types/need';
import type { Resource, VerificationStatus, VeteranRelevance } from '@/types/resource';
import type { ResourceSearchResult } from './ResourceService';

/**
 * The "explainable ordering" applied to Supabase results: for "today" needs,
 * open-now first; then nearest; then veteran resources at equal distance; then
 * most-verified. Sorting lives client-side because it depends on
 * client-computed open-now state.
 */

const VERIFICATION_RANK: Record<VerificationStatus, number> = {
  verified: 0,
  needs_review: 1,
  unverified: 2,
};

const RELEVANCE_RANK: Record<VeteranRelevance, number> = {
  veteran_specific: 0,
  veteran_benefit: 1,
  general: 2,
};

/**
 * A statewide/national veteran referral — a veteran resource with no pinpoint
 * location (a hotline, or an SSVF provider that serves whole counties). These
 * render in their own "Statewide & national veteran help" section instead of
 * competing on distance. Requires a null address too: a row with a street
 * address but no coordinates (e.g. an un-geocoded job posting) is a place, not
 * a referral, and stays in the normal list.
 */
export const isNationalReferral = (resource: Resource): boolean =>
  resource.latitude === null &&
  resource.longitude === null &&
  resource.address === null &&
  resource.veteran_relevance !== 'general';

/**
 * Keep referrals relevant to where the veteran is: a referral tagged with one
 * or more `state:XX` (e.g. SSVF providers) shows only when it serves the
 * veteran's state; untagged referrals (national hotlines) always show. When the
 * veteran's state is unknown, drop state-scoped referrals rather than show
 * out-of-state ones.
 */
export const filterReferralsByState = (
  referrals: ResourceSearchResult[],
  veteranState: string | null,
): ResourceSearchResult[] =>
  referrals.filter((r) => {
    const stateTags = r.resource.tags.filter((t) => t.startsWith('state:'));
    if (stateTags.length === 0) return true;
    return veteranState !== null && stateTags.includes(`state:${veteranState}`);
  });

/**
 * Below this many local results, the statewide/national referrals are treated as
 * the answer and lead the list; at or above it they're backup and sit underneath.
 *
 * Two or fewer nearby places is not a real set of options — that's the case a
 * hotline genuinely helps with. Above that, leading with "call this national
 * number" buries the local help the veteran actually asked for.
 */
const THIN_LOCAL_RESULTS = 3;

export interface SplitResults {
  /** Places near the veteran, strictly within the search radius. */
  locals: ResourceSearchResult[];
  /** Statewide/national veteran referrals serving the veteran's state. */
  referrals: ResourceSearchResult[];
  /** True when referrals should render above locals rather than below. */
  referralsLead: boolean;
}

/**
 * Split search results into nearby places and statewide/national referrals.
 *
 * Shared by the Results and Discover screens, which previously each carried
 * their own copy of this logic — and both rendered the referral strip above the
 * local list unconditionally, so a veteran with 100 nearby VSO offices still led
 * with a national hotline. `referralsLead` makes that placement conditional.
 */
export function splitLocalsAndReferrals(
  results: ResourceSearchResult[],
  veteranState: string | null,
): SplitResults {
  const locals = results.filter((r) => !isNationalReferral(r.resource));
  const referrals = filterReferralsByState(
    results.filter((r) => isNationalReferral(r.resource)),
    veteranState,
  );
  return { locals, referrals, referralsLead: locals.length < THIN_LOCAL_RESULTS };
}

/** null distances (location-independent resources, e.g. a crisis line) sort last. */
const distanceKey = (distance: number | null): number =>
  distance === null ? Number.POSITIVE_INFINITY : distance;

/** Open now sorts before unknown, which sorts before closed. */
const openNowKey = (isOpen: boolean | null): number => (isOpen === true ? 0 : isOpen === null ? 1 : 2);

/** Nearest first, then veteran-first, then most-verified. Used for browse (Discover). */
export const compareByDistanceThenVerification = (
  a: ResourceSearchResult,
  b: ResourceSearchResult,
): number => {
  const distanceDelta = distanceKey(a.distanceMiles) - distanceKey(b.distanceMiles);
  if (distanceDelta !== 0) return distanceDelta;
  const relevanceDelta =
    RELEVANCE_RANK[a.resource.veteran_relevance] - RELEVANCE_RANK[b.resource.veteran_relevance];
  if (relevanceDelta !== 0) return relevanceDelta;
  return (
    VERIFICATION_RANK[a.resource.verification_status] -
    VERIFICATION_RANK[b.resource.verification_status]
  );
};

/** Full search ordering: urgency-aware (open-now leads for "today" needs). */
export function sortSearchResults(
  results: ResourceSearchResult[],
  urgency: Urgency,
): ResourceSearchResult[] {
  const prioritizeOpen = urgency === 'today';

  return [...results].sort((a, b) => {
    if (prioritizeOpen) {
      const openDelta = openNowKey(a.isOpenNow) - openNowKey(b.isOpenNow);
      if (openDelta !== 0) return openDelta;
    }
    return compareByDistanceThenVerification(a, b);
  });
}
