import { SupabaseResourceService } from './supabaseResourceService';
import type { ResourceService } from './ResourceService';

export type {
  ResourceService,
  ResourceQuery,
  ResourceSearchResult,
} from './ResourceService';
export { needToResourceCategories, resourceToNeedCategory } from './needMapping';

/**
 * The app's resource service — the REAL Supabase backend, always. There is no
 * simulated fallback: every resource comes from the live ingestion pipeline
 * (VA, HRSA, SAMHSA, HUD, USAJOBS, College Scorecard). Without Supabase env,
 * resource calls throw and surface as the error/retry UI — never fake data.
 */
export const resourceService: ResourceService = new SupabaseResourceService();
