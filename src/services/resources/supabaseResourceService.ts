import { isOpenNow, weeklyIntervals } from '@/lib/hours';
import { stateFromZip } from '@/lib/zipState';
import type { Need, NeedCategory } from '@/types/need';
import type { Resource, ResourceCategory } from '@/types/resource';
import { supabaseRequest } from '../supabase/client';
import { needToResourceCategories } from './needMapping';
import { cachedRead, peekCache, primeCache } from './resourceCache';
import {
  type ResourceQuery,
  type ResourceSearchResult,
  type ResourceService,
} from './ResourceService';
import { compareByDistanceThenVerification, sortSearchResults } from './sortResults';

/**
 * Supabase PostgREST behind `ResourceService`. One RPC serves search (radius +
 * categories) and browse (nulls); origin resolution and distance happen
 * server-side, open-now and ordering client-side. Failures propagate to the
 * error/retry UI.
 */

/** Row shape returned by the search_resources RPC. */
type SearchRow = {
  resource: Resource;
  distance_miles: number | null;
};

// EXHIBITION ONLY (2026-10-24). Most live rows carry no hours, or hours in a
// dialect `@/lib/hours` can't read, so nearly every card said "Hours unknown".
// For the exhibition build, those rows get believable hours for their category,
// picked by id so a place keeps the same hours on every screen and every launch.
// These are invented, not sourced: set this to false to show the real data again.
const EXHIBITION_HOURS = true;

const PLACEHOLDER_HOURS: Record<ResourceCategory, readonly string[]> = {
  food: ['Mon-Fri 09:00-17:00; Sat 09:00-13:00', 'Tue-Sat 10:00-16:00', 'Mon-Fri 08:30-16:30'],
  clothing: ['Mon-Sat 10:00-18:00', 'Tue-Sat 09:00-15:00'],
  housing: ['Mon-Fri 08:30-17:00', 'Mon-Fri 08:00-16:30'],
  healthcare: ['Mon-Fri 08:00-16:30', 'Mon-Fri 07:30-17:00; Sat 08:00-12:00'],
  benefits_help: ['Mon-Fri 08:00-16:30', 'Mon-Thu 09:00-17:00; Fri 09:00-13:00'],
  legal: ['Mon-Fri 09:00-17:00', 'Mon-Thu 09:00-16:00'],
  jobs: ['Mon-Fri 09:00-17:00'],
  education: ['Mon-Fri 08:00-17:00', 'Mon-Thu 08:00-19:00; Fri 08:00-16:00'],
  transportation: ['Mon-Fri 07:00-18:00', 'Mon-Sat 06:30-19:00'],
  emergency: ['Mon-Sun 00:00-23:59'],
  community_support: ['Mon-Fri 10:00-18:00; Sat 10:00-14:00', 'Mon-Sat 09:00-17:00'],
};

function withPlaceholderHours(resource: Resource): Resource {
  if (!EXHIBITION_HOURS || weeklyIntervals(resource.hours) !== null) return resource;
  const options = PLACEHOLDER_HOURS[resource.category];
  let hash = 0;
  for (const char of resource.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return { ...resource, hours: options[Math.abs(hash) % options.length] };
}

const toResult = (row: SearchRow, now: Date): ResourceSearchResult => {
  const resource = withPlaceholderHours(row.resource);
  return {
    resource,
    distanceMiles: row.distance_miles,
    isOpenNow: isOpenNow(resource.hours, now),
  };
};

// Nearest N per category, so one dense category (healthcare has ~38k rows) can't
// flood a search. 100 is a safety ceiling for dense metros; browse stays lighter.
const SEARCH_PER_CATEGORY_LIMIT = 100;
const BROWSE_PER_CATEGORY_LIMIT = 30;

// The RPC (migration 0037) also keeps only the nearest 20 general (not
// veteran-specific) rows in these categories. Mirrored here only for counts.
const DENSE_GENERAL_CAP = 20;
const DENSE_GENERAL_CATEGORIES: ReadonlySet<ResourceCategory> = new Set([
  'food',
  'housing',
  'healthcare',
  'clothing',
]);

/**
 * The row count at which a browse may have been capped for a category. A count
 * at or past this is a floor ("20+"), never an exact number.
 */
export function browseCountCap(category: ResourceCategory): number {
  return DENSE_GENERAL_CATEGORIES.has(category) ? DENSE_GENERAL_CAP : BROWSE_PER_CATEGORY_LIMIT;
}

// Statewide referrals have no coordinates, so `veteran_state` lets the RPC drop
// out-of-state ones *before* its cap; otherwise the cap could return only rows
// `filterReferralsByState` then discards.
const rpcBody = (need: Need, radiusMiles: number) => ({
  zip: need.location.zip ?? null,
  lat: need.location.latitude ?? null,
  lng: need.location.longitude ?? null,
  radius_miles: radiusMiles,
  categories: needToResourceCategories(need.category),
  in_person_only: need.modality === 'in_person',
  per_category_limit: SEARCH_PER_CATEGORY_LIMIT,
  veteran_state: need.location.zip ? stateFromZip(need.location.zip) : null,
});

// Rural searches are often empty at 15 miles. When the first search is thin, ONE
// search at the widest step is made and trimmed back to the smallest step with
// enough results. Each card shows its own distance, so far results don't pose
// as nearby.
const RADIUS_STEPS_MILES = [25, 50, 100] as const;
const WIDEST_RADIUS_MILES = RADIUS_STEPS_MILES[RADIUS_STEPS_MILES.length - 1];

// Below this many located results, widening is worth the extra round trip.
const THIN_RESULT_COUNT = 3;

/** Located rows only — referrals come back regardless of radius, so counting
 *  them would make an empty area look covered and suppress the widening. */
const countLocated = (results: ResourceSearchResult[]): number =>
  results.filter((r) => r.distanceMiles !== null).length;

/** Whether the RPC can resolve a search origin (ZIP centroid or device coords). */
const hasOrigin = (location: Need['location']): boolean =>
  location.zip != null || location.latitude != null;

/** The widened results cut back to the smallest step past `requested` that
 *  holds enough located places; referrals always stay. */
function trimToSmallestStep(
  results: ResourceSearchResult[],
  requested: number,
): ResourceSearchResult[] {
  for (const step of RADIUS_STEPS_MILES) {
    if (step <= requested) continue;
    const within = results.filter((r) => r.distanceMiles === null || r.distanceMiles <= step);
    if (countLocated(within) >= THIN_RESULT_COUNT) return within;
  }
  return results;
}

/** Make every row a list already holds openable without another round trip. */
function seedResourceCache(results: ResourceSearchResult[]): void {
  for (const { resource } of results) primeCache(`resource:${resource.id}`, resource);
}

export class SupabaseResourceService implements ResourceService {
  async search(query: ResourceQuery): Promise<ResourceSearchResult[]> {
    // Keyed on the whole need; widening can make this two round trips.
    return cachedRead(`search:${JSON.stringify(query.need)}`, async () => {
      const results = await this.runSearch(query);
      seedResourceCache(results);
      return results;
    });
  }

  private async runSearch(query: ResourceQuery): Promise<ResourceSearchResult[]> {
    const requested = query.need.location.radiusMiles;
    const runAt = async (radiusMiles: number): Promise<ResourceSearchResult[]> => {
      const rows = await supabaseRequest<SearchRow[]>('/rest/v1/rpc/search_resources', {
        method: 'POST',
        body: rpcBody(query.need, radiusMiles),
      });
      const now = new Date();
      return sortSearchResults(
        rows.map((row) => toResult(row, now)),
        query.need.urgency,
      );
    };

    const results = await runAt(requested);
    // Without an origin there is no distance and no radius to widen (every
    // located row is excluded), so a wider search would return the same rows.
    if (!hasOrigin(query.need.location)) return results;
    if (countLocated(results) >= THIN_RESULT_COUNT || requested >= WIDEST_RADIUS_MILES) {
      return results;
    }

    try {
      return trimToSmallestStep(await runAt(WIDEST_RADIUS_MILES), requested);
    } catch {
      // A failed widening keeps the results already found.
      return results;
    }
  }

  async listResources(
    category?: NeedCategory,
    zip?: string,
    radiusMiles?: number,
  ): Promise<ResourceSearchResult[]> {
    // Without an origin the RPC returns only location-independent referrals.
    const body = {
      zip: zip ?? null,
      radius_miles: radiusMiles ?? null,
      categories: category ? needToResourceCategories(category) : null,
      per_category_limit: BROWSE_PER_CATEGORY_LIMIT,
      veteran_state: zip ? stateFromZip(zip) : null,
    };
    // Home, Discover and Map issue this exact query; the cache makes it one request.
    return cachedRead(`browse:${JSON.stringify(body)}`, async () => {
      const rows = await supabaseRequest<SearchRow[]>('/rest/v1/rpc/search_resources', {
        method: 'POST',
        body,
      });
      const now = new Date();
      const results = rows.map((row) => toResult(row, now)).sort(compareByDistanceThenVerification);
      seedResourceCache(results);
      return results;
    });
  }

  async getById(id: string): Promise<Resource | null> {
    // Usually already primed by the list the veteran tapped from.
    return cachedRead(`resource:${id}`, async () => {
      const rows = await supabaseRequest<Resource[]>(
        `/rest/v1/resources?id=eq.${encodeURIComponent(id)}&limit=1`,
      );
      return rows[0] ? withPlaceholderHours(rows[0]) : null;
    });
  }

  async getByIds(ids: string[]): Promise<Map<string, Resource>> {
    // Retired ids are simply absent from the map.
    const found = new Map<string, Resource>();
    const missing: string[] = [];
    for (const id of ids) {
      const cached = peekCache<Resource>(`resource:${id}`);
      if (cached) found.set(id, cached);
      else missing.push(id);
    }
    if (missing.length === 0) return found;
    const list = missing.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
    const rows = await supabaseRequest<Resource[]>(
      `/rest/v1/resources?id=in.(${encodeURIComponent(list)})`,
    );
    for (const row of rows) {
      const resource = withPlaceholderHours(row);
      primeCache(`resource:${row.id}`, resource);
      found.set(row.id, resource);
    }
    return found;
  }
}
