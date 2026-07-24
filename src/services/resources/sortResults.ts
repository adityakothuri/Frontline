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
 * A national veteran referral (hotline/program with no physical location).
 * These render in their own "National help lines" strip instead of competing
 * on distance — a crisis line sorted last by its null distance would be the
 * worst possible slot for it. Requires a null address too: a row with a street
 * address but no coordinates (e.g. an un-geocoded job posting) is a place, not
 * a help line, and stays in the normal list.
 */
export const isNationalReferral = (resource: Resource): boolean =>
  resource.latitude === null &&
  resource.longitude === null &&
  resource.address === null &&
  resource.veteran_relevance !== 'general';

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
