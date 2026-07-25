import { isOpenNow } from '@/lib/hours';
import type { Need, NeedCategory } from '@/types/need';
import type { Resource, ResourceCategory } from '@/types/resource';
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

// Cap results per category so one dense category (healthcare has ~38k rows)
// can't flood a search or the map. It's the NEAREST N per category, so a veteran
// still sees plenty of local options; the map stays balanced and fast. A focused
// search can show a few more than a browse-everything map.
// A focused single-category search (e.g. tapping Legal) should show ALL
// resources within the radius, not an arbitrary slice — the radius is the
// bound. 100 is a safety ceiling for pathological dense metros; browse-all
// stays lower so the interleaved feed doesn't fetch everything at once.
const SEARCH_PER_CATEGORY_LIMIT = 100;
const BROWSE_PER_CATEGORY_LIMIT = 30;

// A few categories carry dense general (open-to-everyone) data where veterans
// have no veteran-specific dataset — food pantries (Feeding America) and general
// housing counseling (HUD). Cap them to the nearest N so a veteran-focused feed
// never fills with them; the veteran-specific rows in the same category (e.g. SSVF
// housing) are labeled `veteran_specific`/`veteran_benefit`, so capDenseGeneral
// leaves them untouched and they keep the full per-category limit above. Applied
// AFTER the distance sort, so it keeps the nearest ones.
const DENSE_GENERAL_CAPS: Partial<Record<ResourceCategory, number>> = { food: 20, housing: 20 };

function capDenseGeneral(results: ResourceSearchResult[]): ResourceSearchResult[] {
  const counts = new Map<string, number>();
  return results.filter((r) => {
    const cap = DENSE_GENERAL_CAPS[r.resource.category];
    // Only cap the general rows (the dense pantries). Veteran rows — including
    // the national veteran food referral — are never dropped.
    if (cap === undefined || r.resource.veteran_relevance !== 'general') return true;
    const n = (counts.get(r.resource.category) ?? 0) + 1;
    counts.set(r.resource.category, n);
    return n <= cap;
  });
}

const rpcBody = (need: Need) => ({
  zip: need.location.zip ?? null,
  lat: need.location.latitude ?? null,
  lng: need.location.longitude ?? null,
  radius_miles: need.location.radiusMiles,
  categories: needToResourceCategories(need.category),
  in_person_only: need.modality === 'in_person',
  per_category_limit: SEARCH_PER_CATEGORY_LIMIT,
});

class SupabaseResourceService implements ResourceService {
  async search(query: ResourceQuery): Promise<ResourceSearchResult[]> {
    const rows = await supabaseRequest<SearchRow[]>('/rest/v1/rpc/search_resources', {
      method: 'POST',
      body: rpcBody(query.need),
    });
    const now = new Date();
    return capDenseGeneral(
      sortSearchResults(
        rows.map((row) => toResult(row, now)),
        query.need.urgency,
      ),
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
        per_category_limit: BROWSE_PER_CATEGORY_LIMIT,
      },
    });
    const now = new Date();
    return capDenseGeneral(
      rows.map((row) => toResult(row, now)).sort(compareByDistanceThenVerification),
    );
  }

  async getById(id: string): Promise<Resource | null> {
    const rows = await supabaseRequest<Resource[]>(
      `/rest/v1/resources?id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    return rows[0] ?? null;
  }
}

export { SupabaseResourceService };
