import { SupabaseResourceService } from './supabaseResourceService';
import type { ResourceService } from './ResourceService';

export type { ResourceService, ResourceQuery, ResourceSearchResult } from './ResourceService';
export { resourceToNeedCategory } from './needMapping';
export { splitLocalsAndReferrals, demoteDownvoted } from './sortResults';
export { browseCountCap } from './supabaseResourceService';

/** The app's resource service: the live Supabase backend. Without Supabase env,
 *  calls throw into the error/retry UI; there is no simulated fallback. */
export const resourceService: ResourceService = new SupabaseResourceService();
