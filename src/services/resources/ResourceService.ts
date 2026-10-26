import type { Need, NeedCategory } from '@/types/need';
import type { Resource } from '@/types/resource';

/** The contract screens depend on, implemented by `SupabaseResourceService`. */

export interface ResourceQuery {
  need: Need;
}

/** A resource plus fields derived at query time (not stored on the model). */
export interface ResourceSearchResult {
  resource: Resource;
  /** Distance from the searcher in miles, or null if location is unknown. */
  distanceMiles: number | null;
  /** Whether the resource is open now, or null if hours are unknown. */
  isOpenNow: boolean | null;
}

export interface ResourceService {
  /** Nearby resources matching the need, sorted by relevance then distance. */
  search(query: ResourceQuery): Promise<ResourceSearchResult[]>;
  /**
   * Browse without a full need (all categories, or one), sorted by distance then
   * verification. `zip` is the origin; with `radiusMiles` too, browse is scoped
   * to that radius. Location-independent resources (crisis lines) always pass.
   */
  listResources(
    category?: NeedCategory,
    zip?: string,
    radiusMiles?: number,
  ): Promise<ResourceSearchResult[]>;
  /** A single resource by id, or null if not found. */
  getById(id: string): Promise<Resource | null>;
  /** Several resources in one request, keyed by id; retired ids are absent. */
  getByIds(ids: string[]): Promise<Map<string, Resource>>;
}
