-- Cold cache is what actually broke Discover and Map.
--
-- The `anon` role runs with `statement_timeout=3s` (`authenticated` gets 8s).
-- Ranking a dense metro — ZIP 90210, ~6,900 rows inside a 15-mile box, and 15 is
-- the app's DEFAULT radius — drove an index scan that then fetched one random
-- HEAP page per candidate row: 6,911 buffer reads. Warm that is ~220ms. Cold,
-- every one of those is disk I/O, the statement ran past 3s, Postgres cancelled
-- it (SQLSTATE 57014 "canceling statement due to statement timeout"), PostgREST
-- returned 500, and the app rendered "Something went wrong".
--
-- That is the whole shape of the bug report: it looked like a first-open-only
-- problem because the second attempt found the pages already cached and took
-- 0.5s. Counter-intuitively the DEFAULT 15-mile radius failed while 25/50/250
-- succeeded — a small dense box makes the planner pick the row-at-a-time index
-- scan, where a wider one gets a bitmap scan that reads each page once.
--
-- Carrying id, category and veteran_relevance in the index lets the ranking
-- phase run Index Only: it never touches the heap, and only the rows that
-- survive the per-category limit are fetched. Buffer traffic 6,911 -> ~1,180.
--
-- Partial on `latitude is not null` because the referral arm of the query wants
-- exactly the opposite set, and every located row has coordinates. Costs 16 MB.
--
-- `id` must stay in the INCLUDE list. Without it the planner has to visit the
-- heap for every row anyway and silently falls back to a plain Index Scan, which
-- is how the first cut of this index bought nothing at all.

create index if not exists resources_geo_rank_idx
  on public.resources (latitude, longitude)
  include (id, category, veteran_relevance)
  where latitude is not null;

-- Index Only Scans skip the heap only where the visibility map says a page is
-- all-visible, so the index is worth little until the table has been vacuumed.
analyze public.resources;
