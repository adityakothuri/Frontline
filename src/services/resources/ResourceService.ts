import type { Need, NeedCategory } from '@/types/need';
import type { Resource } from '@/types/resource';

/**
 * The contract screens depend on. The MVP ships an in-memory mock
 * (`mockResourceService`); a real backend later implements the same interface,
 * so swapping mock → real is a drop-in. See
 * `docs/obsidian/03 Technical/Technical Architecture.md`.
 */

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
   * Browse opportunities without a full need — all of them, or one category —
   * for the Discover tab. Sorted by distance then verification; no modality or
   * radius filtering (browsing shows everything).
   */
  listResources(category?: NeedCategory): Promise<ResourceSearchResult[]>;
  /** A single resource by id, or null if not found. */
  getById(id: string): Promise<Resource | null>;
}
