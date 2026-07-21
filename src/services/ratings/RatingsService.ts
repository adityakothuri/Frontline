import type { Rating } from '@/types/activity';

/**
 * Community rating for a resource — REAL thumbs data, never simulated. The
 * aggregate is the count of up/down votes across all devices; it is 0 until
 * veterans actually vote, and grows as they do. The veteran's own vote is
 * tracked separately (on-device) by ActivityContext.
 */
export interface RatingAggregate {
  helpful: number;
  notHelpful: number;
}

export const EMPTY_RATING: RatingAggregate = { helpful: 0, notHelpful: 0 };

export interface RatingsService {
  /** The current aggregate for a resource (0/0 when nobody has voted). */
  getAggregate(resourceId: string): Promise<RatingAggregate>;
  /** Record this device's vote and return the updated aggregate. */
  submitVote(resourceId: string, deviceId: string, vote: Rating): Promise<RatingAggregate>;
}
