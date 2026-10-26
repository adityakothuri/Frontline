-- Note: shares the number 0035 with 0035_drop_school_based_health_centers.sql; the two are independent.
--
-- Keep the covering indexes usable after an ingest.
--
-- 0030/0031 added covering indexes so the hot browse/search path runs Index Only
-- and never touches the heap. That only holds while the **visibility map** says
-- the pages are all-visible — and a bulk upsert leaves every page it touched
-- not-all-visible until a VACUUM sets the bits again.
--
-- Observed 2026-07-28, immediately after the third data pass: the planner
-- abandoned `resources_geo_rank_idx` and fell back to a plain Index Scan on the
-- old lat/lng index — 5,657 buffers, 2,368 physical reads, 2.46s for a stage
-- that is 4.7ms with an Index Only Scan. That pushed the browse query back over
-- the `anon` role's 3s statement_timeout and the app started serving
-- "Something went wrong" again. `VACUUM (ANALYZE) resources` fixed it instantly.
--
-- The defaults could not have caught this. On ~186k rows they are:
--
--   insert-vacuum   1000 + 0.2  * 186,379  ~= 38,300 inserts
--   dead-tuple vac         0.2  * 186,379  ~= 37,300 dead rows
--   analyze                0.1  * 186,379  ~= 18,600 changes
--
-- A single provider refresh is usually smaller than that, so it triggers
-- *nothing*, and the indexes silently stop being used until some later write
-- crosses the threshold. The insert knobs matter most here: an upsert that adds
-- rows produces few dead tuples but plenty of not-all-visible pages, which is
-- exactly the case `autovacuum_vacuum_insert_*` governs (PG13+; this is 17.6).
--
-- Tuned per-table rather than bolted onto the ingestion script on purpose: this
-- covers every write path — `ingestion/run.ts`, `reap.ts` deletes, and any
-- manual fix-up — and cannot be forgotten by a new one. A literal `VACUUM` is
-- not available to the pipeline anyway: it cannot run inside a transaction or a
-- function, so it cannot be issued over PostgREST, and the refresh workflow
-- holds only SUPABASE_URL + the service key, no Postgres connection string.

alter table public.resources set (
  -- ~2,900 inserts instead of ~38,300 — the knob that actually governs this bug.
  autovacuum_vacuum_insert_threshold = 1000,
  autovacuum_vacuum_insert_scale_factor = 0.01,
  -- ~4,700 dead rows instead of ~37,300.
  autovacuum_vacuum_threshold = 1000,
  autovacuum_vacuum_scale_factor = 0.02,
  -- ~2,900 changes instead of ~18,600, so row estimates stay honest between runs.
  autovacuum_analyze_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.01,
  -- Default 200 makes a vacuum of a 200MB table crawl, which would leave the
  -- app degraded for the whole run. This is a batch-written catalogue with no
  -- interactive writers to starve, so let it finish.
  autovacuum_vacuum_cost_limit = 2000
);

-- Leave the table in the good state rather than waiting for the first trigger.
analyze public.resources;
