import { MockResourceService } from './mockResourceService';
import type { ResourceService } from './ResourceService';

export type {
  ResourceService,
  ResourceQuery,
  ResourceSearchResult,
} from './ResourceService';
export { needToResourceCategories } from './needMapping';
export { SEED_CENTER } from './seedResources';

/** The app's resource service. Swap this out for a real backend in Phase 10. */
export const resourceService: ResourceService = new MockResourceService();
