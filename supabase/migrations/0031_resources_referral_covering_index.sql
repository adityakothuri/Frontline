-- The referral arm of `search_resources` is a constant tax on every query.
--
-- It selects the nationwide/statewide rows (no coordinates, no address) and was
-- reaching them through the lat/lng index, which yielded 4,817 candidates and
-- then read 2,657 random heap blocks to filter down to ~92. Unlike the located
-- arm this cost does not vary with the veteran's ZIP — every search and browse
-- pays it, and cold that is thousands of disk reads against the `anon` role's
-- 3s statement_timeout.
--
-- Only 1,556 rows qualify, so a partial covering index over exactly that set
-- keeps the whole arm off the heap.

create index if not exists resources_referral_idx
  on public.resources (veteran_relevance)
  include (id, category, tags)
  where latitude is null and address is null;

analyze public.resources;
