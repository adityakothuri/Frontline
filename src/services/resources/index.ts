import { SupabaseResourceService } from './supabaseResourceService';
import type { ResourceService } from './ResourceService';

export type { ResourceService, ResourceQuery, ResourceSearchResult } from './ResourceService';
export { needToResourceCategories, resourceToNeedCategory } from './needMapping';
export {
  isNationalReferral,
  filterReferralsByState,
  splitLocalsAndReferrals,
  demoteDownvoted,
} from './sortResults';
export type { SplitResults } from './sortResults';
export { invalidateResourceCache } from './resourceCache';

/**
 * The app's resource service — the REAL Supabase backend, always. There is no
 * simulated fallback: every resource comes from the live ingestion pipeline
 * (VA, USAJOBS, GI Bill, HUD, SSVF, curated veteran referrals). Without Supabase
 * env, resource calls throw and surface as the error/retry UI — never fake data.
 */
export const resourceService: ResourceService = new SupabaseResourceService();
