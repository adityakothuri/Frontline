import { distanceMiles, type Coordinates } from '@/lib/geo';
import { isOpenNow } from '@/lib/hours';
import type { Need, NeedCategory } from '@/types/need';
import type { Resource, VerificationStatus } from '@/types/resource';

import { needToResourceCategories } from './needMapping';
import {
  type ResourceQuery,
  type ResourceSearchResult,
  type ResourceService,
} from './ResourceService';
import { SEED_CENTER, seedResources } from './seedResources';

/** Simulated network latency so loading states are real in the demo. */
const simulateLatency = (ms = 350): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const coordsOf = (resource: Resource): Coordinates | null =>
  resource.latitude !== null && resource.longitude !== null
    ? { latitude: resource.latitude, longitude: resource.longitude }
    : null;

/**
 * The searcher's origin. In the MVP we don't geocode a ZIP, so when we only have
 * a ZIP we fall back to the seed data's city center — this keeps distances
 * meaningful in the demo. Real geocoding arrives with the backend (Phase 10).
 */
const originOf = (need: Need): Coordinates => {
  const { latitude, longitude } = need.location;
  if (latitude !== undefined && longitude !== undefined) {
    return { latitude, longitude };
  }
  return SEED_CENTER;
};

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

/** Nearest first, then most-verified. Shared by search's tail and browse. */
const compareByDistanceThenVerification = (
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

class MockResourceService implements ResourceService {
  private readonly resources: Resource[];

  constructor(resources: Resource[] = seedResources) {
    this.resources = resources;
  }

  async search(query: ResourceQuery): Promise<ResourceSearchResult[]> {
    await simulateLatency();

    const { need } = query;
    const categories = new Set(needToResourceCategories(need.category));
    const origin = originOf(need);
    const now = new Date();

    const results: ResourceSearchResult[] = [];

    for (const resource of this.resources) {
      if (!categories.has(resource.category)) continue;

      const coords = coordsOf(resource);
      // In-person searches only want resources with a physical location.
      if (need.modality === 'in_person' && !coords) continue;

      const distance = coords ? distanceMiles(origin, coords) : null;
      // Enforce the radius only when we know the distance; location-independent
      // resources (e.g. a crisis line) always pass through.
      if (distance !== null && distance > need.location.radiusMiles) continue;

      results.push({
        resource,
        distanceMiles: distance,
        isOpenNow: isOpenNow(resource.hours, now),
      });
    }

    return this.sort(results, need);
  }

  async listResources(category?: NeedCategory): Promise<ResourceSearchResult[]> {
    await simulateLatency();

    const filter = category ? new Set(needToResourceCategories(category)) : null;
    const now = new Date();
    const results: ResourceSearchResult[] = [];

    for (const resource of this.resources) {
      if (filter && !filter.has(resource.category)) continue;
      const coords = coordsOf(resource);
      results.push({
        resource,
        // Browsing has no "searcher" beyond the seed city, and no radius filter.
        distanceMiles: coords ? distanceMiles(SEED_CENTER, coords) : null,
        isOpenNow: isOpenNow(resource.hours, now),
      });
    }

    return [...results].sort(compareByDistanceThenVerification);
  }

  async getById(id: string): Promise<Resource | null> {
    await simulateLatency(150);
    return this.resources.find((resource) => resource.id === id) ?? null;
  }

  /**
   * Explainable ordering: for "today" needs, open-now first; then nearest,
   * then most-verified. For less urgent needs, distance leads.
   */
  private sort(results: ResourceSearchResult[], need: Need): ResourceSearchResult[] {
    const prioritizeOpen = need.urgency === 'today';

    return [...results].sort((a, b) => {
      if (prioritizeOpen) {
        const openDelta = openNowKey(a.isOpenNow) - openNowKey(b.isOpenNow);
        if (openDelta !== 0) return openDelta;
      }
      return compareByDistanceThenVerification(a, b);
    });
  }
}

export { MockResourceService };
