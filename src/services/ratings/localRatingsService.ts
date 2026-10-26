import { EMPTY_RATING, type RatingAggregate, type RatingsService } from './RatingsService';

/** Offline RatingsService: no server means no shared count, so aggregates are 0. */
export class LocalRatingsService implements RatingsService {
  async getAggregate(): Promise<RatingAggregate> {
    return EMPTY_RATING;
  }

  async submitVote(): Promise<RatingAggregate> {
    return EMPTY_RATING;
  }
}
