import type { Rating } from '@/types/activity';
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
 * A statewide/national veteran referral: a veteran resource with no location
 * (a hotline, a county-wide provider). A row with an address but no coordinates
 * is an un-geocoded place, not a referral.
 */
export const isNationalReferral = (resource: Resource): boolean =>
  resource.latitude === null &&
  resource.longitude === null &&
  resource.address === null &&
  resource.veteran_relevance !== 'general';

/**
 * A `state:XX`-tagged referral shows only in the veteran's state; untagged ones
 * (national hotlines) always show. With the state unknown, state-scoped ones drop.
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

/** Below this many local results, referrals lead the list; otherwise they follow it. */
const THIN_LOCAL_RESULTS = 3;

export interface SplitResults {
  /** Places near the veteran, strictly within the search radius. */
  locals: ResourceSearchResult[];
  /** Statewide/national veteran referrals serving the veteran's state. */
  referrals: ResourceSearchResult[];
  /** True when referrals should render above locals rather than below. */
  referralsLead: boolean;
}

/** Split search results into nearby places and statewide/national referrals. */
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

/**
 * Sinks places the veteran marked "Not helpful" below everything else — what
 * makes the review card's "we'll show this one lower" true. Only the rated place,
 * not "places like it". A stable partition rather than a sort key, so the normal
 * ordering survives within each group and a downvote falls below even a distant
 * unverified place.
 */
export function demoteDownvoted(
  results: ResourceSearchResult[],
  getRating: (resourceId: string) => Rating | undefined,
): ResourceSearchResult[] {
  const kept: ResourceSearchResult[] = [];
  const sunk: ResourceSearchResult[] = [];
  for (const result of results) {
    (getRating(result.resource.id) === 'down' ? sunk : kept).push(result);
  }
  if (sunk.length === 0 || kept.length === 0) return results;
  return [...kept, ...sunk];
}

/** null distances (location-independent resources, e.g. a crisis line) sort last. */
const distanceKey = (distance: number | null): number =>
  distance === null ? Number.POSITIVE_INFINITY : distance;

/** Open now sorts before unknown, which sorts before closed. */
const openNowKey = (isOpen: boolean | null): number =>
  isOpen === true ? 0 : isOpen === null ? 1 : 2;

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
