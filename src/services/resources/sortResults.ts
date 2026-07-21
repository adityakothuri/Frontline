import type { Urgency } from '@/types/need';
import type { VerificationStatus } from '@/types/resource';
import type { ResourceSearchResult } from './ResourceService';

/**
 * The "explainable ordering" shared by every ResourceService implementation
 * (mock and Supabase), so the two can never drift: for "today" needs, open-now
 * first; then nearest; then most-verified. Sorting lives client-side because
 * it depends on client-computed open-now state.
 */

const VERIFICATION_RANK: Record<VerificationStatus, number> = {
  verified: 0,
  needs_review: 1,
  unverified: 2,
};

/** null distances (location-independent resources, e.g. a crisis line) sort last. */
const distanceKey = (distance: number | null): number =>
  distance === null ? Number.POSITIVE_INFINITY : distance;

/** Open now sorts before unknown, which sorts before closed. */
const openNowKey = (isOpen: boolean | null): number => (isOpen === true ? 0 : isOpen === null ? 1 : 2);

/** Nearest first, then most-verified. Used directly for browse (Discover). */
export const compareByDistanceThenVerification = (
  a: ResourceSearchResult,
  b: ResourceSearchResult,
): number => {
  const distanceDelta = distanceKey(a.distanceMiles) - distanceKey(b.distanceMiles);
  if (distanceDelta !== 0) return distanceDelta;
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
