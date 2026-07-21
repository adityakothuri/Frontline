import { distanceMiles, type Coordinates } from '@/lib/geo';
import { isOpenNow } from '@/lib/hours';
import type { Need, NeedCategory } from '@/types/need';
import type { Resource } from '@/types/resource';

import { needToResourceCategories } from './needMapping';
import { compareByDistanceThenVerification, sortSearchResults } from './sortResults';
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

    return sortSearchResults(results, need.urgency);
  }

  // `zip` is part of the interface for the real backend; the mock has no
  // geocoder and keeps its documented demo-only seed-city origin.
  async listResources(
    category?: NeedCategory,
    _zip?: string,
    radiusMiles?: number,
  ): Promise<ResourceSearchResult[]> {
    await simulateLatency();

    const filter = category ? new Set(needToResourceCategories(category)) : null;
    const now = new Date();
    const results: ResourceSearchResult[] = [];

    for (const resource of this.resources) {
      if (filter && !filter.has(resource.category)) continue;
      const coords = coordsOf(resource);
      // Distance is from the demo seed city (no geocoder). Mirror the backend's
      // radius scoping: drop located resources outside it; null-coord resources
      // (crisis lines) always pass through.
      const distance = coords ? distanceMiles(SEED_CENTER, coords) : null;
      if (distance !== null && radiusMiles !== undefined && distance > radiusMiles) continue;
      results.push({
        resource,
        distanceMiles: distance,
        isOpenNow: isOpenNow(resource.hours, now),
      });
    }

    return [...results].sort(compareByDistanceThenVerification);
  }

  async getById(id: string): Promise<Resource | null> {
    await simulateLatency(150);
    return this.resources.find((resource) => resource.id === id) ?? null;
  }
}

export { MockResourceService };
