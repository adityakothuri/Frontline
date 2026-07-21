import { supabaseConfig } from '../supabase/config';
import { LocalRatingsService } from './localRatingsService';
import { SupabaseRatingsService } from './supabaseRatingsService';
import type { RatingsService } from './RatingsService';

export type { RatingsService, RatingAggregate } from './RatingsService';
export { EMPTY_RATING } from './RatingsService';

/**
 * The app's ratings service. Real Supabase-backed community votes when
 * EXPO_PUBLIC_SUPABASE_* env is set; otherwise an offline stub that reports 0
 * (no shared count without a backend). Never simulated data.
 */
export const ratingsService: RatingsService = supabaseConfig
  ? new SupabaseRatingsService()
  : new LocalRatingsService();
