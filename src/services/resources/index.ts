import { supabaseConfig } from '../supabase/config';
import { MockResourceService } from './mockResourceService';
import { SupabaseResourceService } from './supabaseResourceService';
import type { ResourceService } from './ResourceService';

export type {
  ResourceService,
  ResourceQuery,
  ResourceSearchResult,
} from './ResourceService';
export { needToResourceCategories, resourceToNeedCategory } from './needMapping';

/**
 * The app's resource service. Supabase when EXPO_PUBLIC_SUPABASE_* env is set;
 * otherwise the simulated in-memory mock (full offline/demo mode). Runtime
 * failures of the real service surface as error/retry UI — never mock data.
 */
export const resourceService: ResourceService = supabaseConfig
  ? new SupabaseResourceService()
  : new MockResourceService();
