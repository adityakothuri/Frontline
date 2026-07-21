import { isOpenNow } from '@/lib/hours';
import type { Need, NeedCategory } from '@/types/need';
import type { Resource } from '@/types/resource';
import { supabaseRequest } from '../supabase/client';
import { needToResourceCategories } from './needMapping';
import {
  type ResourceQuery,
  type ResourceSearchResult,
  type ResourceService,
} from './ResourceService';
import { compareByDistanceThenVerification, sortSearchResults } from './sortResults';

/**
 * The ResourceService: Supabase PostgREST behind the `ResourceService`
 * interface. One RPC serves search (radius + categories) and browse (nulls);
 * origin resolution (ZIP -> centroid) and distance happen server-side; open-now
 * and the explainable ordering stay client-side.
 *
 * Failures propagate to the existing error/retry UI — never fake data. All rows
 * are real, ingested from official sources; there is no simulated fallback.
 */

/** Row shape returned by the search_resources RPC. */
type SearchRow = {
  resource: Resource;
  distance_miles: number | null;
};

const toResult = (row: SearchRow, now: Date): ResourceSearchResult => ({
  resource: row.resource,
  distanceMiles: row.distance_miles,
  isOpenNow: isOpenNow(row.resource.hours, now),
});

const rpcBody = (need: Need) => ({
  zip: need.location.zip ?? null,
  lat: need.location.latitude ?? null,
  lng: need.location.longitude ?? null,
  radius_miles: need.location.radiusMiles,
  categories: needToResourceCategories(need.category),
  in_person_only: need.modality === 'in_person',
});

class SupabaseResourceService implements ResourceService {
  async search(query: ResourceQuery): Promise<ResourceSearchResult[]> {
    const rows = await supabaseRequest<SearchRow[]>('/rest/v1/rpc/search_resources', {
      method: 'POST',
      body: rpcBody(query.need),
    });
    const now = new Date();
    return sortSearchResults(
      rows.map((row) => toResult(row, now)),
      query.need.urgency,
    );
  }

  async listResources(
    category?: NeedCategory,
    zip?: string,
    radiusMiles?: number,
  ): Promise<ResourceSearchResult[]> {
    const rows = await supabaseRequest<SearchRow[]>('/rest/v1/rpc/search_resources', {
      method: 'POST',
      // Browse: no modality filter; distances from the profile ZIP when known.
      // A radius keeps the tabs local (the RPC ignores it when the origin is
      // unknown, and always lets null-coord resources through).
      body: {
        zip: zip ?? null,
        radius_miles: radiusMiles ?? null,
        categories: category ? needToResourceCategories(category) : null,
      },
    });
    const now = new Date();
    return rows.map((row) => toResult(row, now)).sort(compareByDistanceThenVerification);
  }

  async getById(id: string): Promise<Resource | null> {
    const rows = await supabaseRequest<Resource[]>(
      `/rest/v1/resources?id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    return rows[0] ?? null;
  }
}

export { SupabaseResourceService };
