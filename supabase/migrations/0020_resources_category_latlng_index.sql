-- The app's primary query is category + a lat/lng bounding box (radius search).
-- A composite index lets that range-scan directly instead of depending on
-- planner stats being fresh after a large re-ingest (a stale-stats plan on the
-- 7.7k VSO legal rows timed out until ANALYZE). Keeps the lat/lng-only index
-- (0017) for the no-category "all" browse.
create index if not exists resources_category_lat_lng_idx
  on public.resources (category, latitude, longitude);
