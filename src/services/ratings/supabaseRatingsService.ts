import type { Rating } from '@/types/activity';
import { supabaseRequest } from '../supabase/client';
import { EMPTY_RATING, type RatingAggregate, type RatingsService } from './RatingsService';

/**
 * The real RatingsService: thumbs votes stored in Postgres, reached through the
 * `get_resource_rating` / `submit_resource_vote` RPCs (the votes table itself is
 * deny-all). One vote per device per resource; counts are aggregated server-side.
 */

/** RPC rows come back as [{ helpful, not_helpful }]. */
type RatingRow = { helpful: number; not_helpful: number };

const toAggregate = (rows: RatingRow[]): RatingAggregate => {
  const row = rows[0];
  return row ? { helpful: row.helpful, notHelpful: row.not_helpful } : EMPTY_RATING;
};

export class SupabaseRatingsService implements RatingsService {
  async getAggregate(resourceId: string): Promise<RatingAggregate> {
    const rows = await supabaseRequest<RatingRow[]>('/rest/v1/rpc/get_resource_rating', {
      method: 'POST',
      body: { p_resource_id: resourceId },
    });
    return toAggregate(rows);
  }

  async submitVote(resourceId: string, deviceId: string, vote: Rating): Promise<RatingAggregate> {
    const rows = await supabaseRequest<RatingRow[]>('/rest/v1/rpc/submit_resource_vote', {
      method: 'POST',
      body: { p_device_id: deviceId, p_resource_id: resourceId, p_vote: vote },
    });
    return toAggregate(rows);
  }
}
