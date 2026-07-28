-- Frontline — clear the Feed America food set for a clean national re-ingest.
--
-- WHY THIS DELETES EVERYTHING RATHER THAN FILTERING
--
-- Profiling the live table on 2026-07-27 found three problems in the 116,500
-- `feed-america` rows, and the third makes a targeted delete pointless:
--
--   1. 51,839 rows (44%) were child-nutrition sites — the `school-meals` and
--      `summer-meals` HSDS taxonomies, i.e. school cafeterias. 28,311 rows had
--      "School"/"Elementary"/"Middle" in the name. Frontline serves older
--      veterans; they cannot eat at an elementary school.
--   2. 5,215 rows were SAMHSA behavioural-health facilities (opioid treatment
--      programs, psychiatric clinics) that arrive from the aggregator carrying
--      a food taxonomy — listed under "food" with methadone intake text in
--      `eligibility`.
--   3. The feed reassigns its row ids on every rebuild. 82,193 of the 116,500
--      ingested ids (71%) already pointed past the feed's current maximum, and
--      4,099 rows were exact name+address duplicates left by earlier runs.
--
-- Because of (3) the adapter now derives `external_id` from normalized
-- name + address (`stableKey()` in ingestion/sources/feedAmericaFood.ts), so
-- every id in this table is obsolete: the next run inserts a fresh set and
-- would strand these rows permanently. Deleting the provider wholesale is the
-- only way to end up with one coherent, de-duplicated national set.
--
-- OPERATIONAL NOTE: this leaves the `food` category empty until the national
-- re-ingest completes. Run it immediately after applying this migration:
--
--     node --experimental-strip-types ingestion/run.ts --source feed-america
--
-- The replacement set covers all 50 states (the old one covered 8 — 42 states,
-- including all of New York, had zero food resources).
--
-- THREE SIDE EFFECTS TO EXPECT, none of which block the purge:
--
--   * `resource_votes.resource_id` is ON DELETE CASCADE (0009), so community
--     votes on food rows are destroyed. Currently zero rows, so nothing is
--     actually lost today — but that stops being true once voting sees use.
--   * Saved lists store resource ids on-device and re-resolve them live
--     (src/services/saved/savedStorage.ts), so a veteran's saved pantry
--     disappears from the Saved tab after this. Re-keying means even the same
--     pantry comes back with a different id, so the old id is dead permanently
--     and `app/(tabs)/saved.tsx` will re-request it on every mount. Pruning ids
--     that resolve to null is worth doing before this ships widely.
--   * `ingestion/freshnessGate.ts` reports "feed-america: NO ROWS" and fails CI
--     in the window between this migration and the re-ingest, which auto-opens a
--     "Data refresh failed" issue. That is the gate working as intended; close
--     the issue once the ingest lands.

begin;

-- resource_sources.resource_id is `on delete set null` (0008), so dropping the
-- resources alone would leave 116,500 lineage rows behind with a null link.
-- Clear them explicitly, by provider, first.
delete from public.resource_sources
where provider = 'feed-america';

delete from public.resources
where source_provider = 'feed-america';

commit;
