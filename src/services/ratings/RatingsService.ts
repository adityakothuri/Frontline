import type { Rating } from '@/types/activity';

/** Community thumbs counts across all devices. The veteran's own vote lives in ActivityContext. */
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
