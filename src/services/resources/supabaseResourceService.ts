import { isOpenNow } from '@/lib/hours';
import { stateFromZip } from '@/lib/zipState';
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
const DENSE_GENERAL_CAPS: Partial<Record<ResourceCategory, number>> = {
  food: 20,
  housing: 20,
  // Added 2026-07-28 with the ~17.6k HRSA community health centres. Veterans now
  // have real veteran-specific healthcare depth (VA facilities plus ~6.2k SAMHSA
  // facilities that report a veterans program), so uncapped general clinics would
  // outnumber them 2:1 in a dense metro and bury the veteran-specific ones the
  // moment one happened to be a block closer.
  healthcare: 20,
  // Added 2026-07-28 with the ~6,750 OpenStreetMap charity/second-hand shops that
  // took `clothing` from a single row to a real category. They are all `general`
  // (no veteran-specific clothing dataset exists anywhere), and a dense metro has
  // dozens within a few miles — without a cap the category becomes a thrift-shop
  // directory rather than a route to help.
  clothing: 20,
};

// How many rows a veteran cannot contact at all may appear per category.
//
// Measured 2026-07-28: 72,286 rows (35% of the catalogue) have NO phone and NO
// website — 23,923 IRS-registered veterans posts, 43,672 Feeding America pantries,
// and the USAspending grantees. They have real, geocoded street addresses, so they
// are worth knowing about when one is round the corner; but sorted purely by
// distance they bury the Vet Centers, SAMHSA facilities and job centres that
// actually answer the phone.
//
// This deliberately does NOT key on a provider or on `veteran_relevance`. The
// obvious approach — adding `community_support` to DENSE_GENERAL_CAPS — silently
// does nothing, because `capDenseGeneral` only filters rows whose relevance is
// `general` and the IRS posts are `veteran_specific`. Keying on the actual harm
// ("you cannot reach this place") is both correct and general: it covers the food
// rows with the same problem, and needs no per-source special-casing.
const UNCONTACTABLE_CAP_PER_CATEGORY = 5;

const isUncontactable = (r: ResourceSearchResult): boolean =>
  r.resource.phone === null && r.resource.website === null;

function capUncontactable(results: ResourceSearchResult[]): ResourceSearchResult[] {
  const counts = new Map<string, number>();
  return results.filter((r) => {
    if (!isUncontactable(r)) return true;
    const n = (counts.get(r.resource.category) ?? 0) + 1;
    counts.set(r.resource.category, n);
    return n <= UNCONTACTABLE_CAP_PER_CATEGORY;
  });
}

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

// Statewide referrals (VSO organizations, SSVF providers) carry `state:XX` tags
// and no coordinates, so the RPC cannot rank them by distance. Telling it the
// veteran's state lets it drop out-of-state referrals and rank in-state ones
// first *before* applying its cap — without this, capping would hand back six
// arbitrary rows that `filterReferralsByState` then filters to nothing.
// The client-side filter stays as the authority when the state is unknown.
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

// Rural searches routinely come back empty at the default 15 miles — measured
// 2026-07-27, a search from rural Montana found 5 resources of any category
// within 25. Widening beats handing that veteran a national hotline. Steps
// follow the radius options a veteran can pick themselves (types/profile.ts),
// extended once past the top so the last resort is still a real place.
//
// Each card shows its own distance, so a result found at 100 miles reads as
// "97 mi" rather than silently posing as nearby.
const RADIUS_STEPS_MILES = [25, 50, 100] as const;

// Below this many located results, widening is worth the extra round trip.
const THIN_RESULT_COUNT = 3;

/** Located rows only — referrals come back regardless of radius, so counting
 *  them would make an empty area look covered and suppress the widening. */
const countLocated = (results: ResourceSearchResult[]): number =>
  results.filter((r) => r.distanceMiles !== null).length;

/** Whether the RPC can resolve a search origin (ZIP centroid or device coords). */
const hasOrigin = (location: Need['location']): boolean =>
  location.zip != null || location.latitude != null;

class SupabaseResourceService implements ResourceService {
  async search(query: ResourceQuery): Promise<ResourceSearchResult[]> {
    const requested = query.need.location.radiusMiles;
    const runAt = async (radiusMiles: number): Promise<ResourceSearchResult[]> => {
      const rows = await supabaseRequest<SearchRow[]>('/rest/v1/rpc/search_resources', {
        method: 'POST',
        body: rpcBody(query.need, radiusMiles),
      });
      const now = new Date();
      return capUncontactable(
        capDenseGeneral(
          sortSearchResults(
            rows.map((row) => toResult(row, now)),
            query.need.urgency,
          ),
        ),
      );
    };

    const results = await runAt(requested);
    // Without an origin the RPC can't compute distance or apply a radius at all
    // (0021: every row comes back with a null distance and no radius filter), so
    // `countLocated` would read 0 forever and every step would re-fetch the same
    // unfiltered payload. Widening only means something once we know where the
    // veteran is.
    if (!hasOrigin(query.need.location)) return results;

    let widened = results;
    for (const step of RADIUS_STEPS_MILES) {
      if (countLocated(widened) >= THIN_RESULT_COUNT) break;
      if (step <= requested) continue; // never search a smaller ring than asked for
      try {
        widened = await runAt(step);
      } catch {
        // A wider search is a bonus, not the request. If it times out — this RPC
        // has a history of it on dense categories — keep what we already found
        // rather than turning two usable results into an error screen.
        break;
      }
    }
    return widened;
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
        veteran_state: zip ? stateFromZip(zip) : null,
      },
    });
    const now = new Date();
    return capUncontactable(
      capDenseGeneral(
        rows.map((row) => toResult(row, now)).sort(compareByDistanceThenVerification),
      ),
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
