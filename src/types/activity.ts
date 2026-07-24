import type { ResourceCategory } from './resource';

/**
 * On-device record of how a veteran has interacted with opportunities, used to
 * power the Home "How was ___?" review prompt. Local-only, nothing sensitive.
 */

export type EngagementAction = 'viewed' | 'called' | 'directions';

export interface EngagementEntry {
  resourceId: string;
  resourceName: string;
  category: ResourceCategory;
  action: EngagementAction;
  /** ISO timestamp of the engagement. */
  at: string;
}

/** A thumbs-up / thumbs-down the veteran left on an opportunity. */
export type Rating = 'up' | 'down';

/** The whole persisted activity blob (one AsyncStorage key). */
export interface ActivityState {
  engagements: EngagementEntry[];
  ratings: Record<string, Rating>;
}
