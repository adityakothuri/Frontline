import { EMPTY_RATING, type RatingAggregate, type RatingsService } from './RatingsService';

/**
 * Offline RatingsService (no backend configured). There is no shared community
 * count without a server, so aggregates are honestly 0 — never simulated. The
 * veteran's own vote is still recorded locally by ActivityContext (which drives
 * the button state and the review prompt); this service only answers "what's the
 * public count?", which offline is nothing yet.
 */
export class LocalRatingsService implements RatingsService {
  async getAggregate(): Promise<RatingAggregate> {
    return EMPTY_RATING;
  }

  async submitVote(): Promise<RatingAggregate> {
    return EMPTY_RATING;
  }
}
