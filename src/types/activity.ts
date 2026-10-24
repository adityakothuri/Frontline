import type { ResourceCategory } from './resource';

/** On-device record of resources a veteran engaged with, feeding the Home review deck. */

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
