import { supabaseConfig } from '../supabase/config';
import { LocalRatingsService } from './localRatingsService';
import { SupabaseRatingsService } from './supabaseRatingsService';
import type { RatingsService } from './RatingsService';

export type { RatingsService, RatingAggregate } from './RatingsService';
export { EMPTY_RATING } from './RatingsService';

/** Supabase-backed community votes, or an offline stub reporting 0 without a backend. */
export const ratingsService: RatingsService = supabaseConfig
  ? new SupabaseRatingsService()
  : new LocalRatingsService();
