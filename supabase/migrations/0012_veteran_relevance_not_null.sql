-- Frontline — lock in the veteran-only guardrail.
--
-- After backfilling the kept sources and purging all general-public data, every
-- row now has a veteran_relevance. Make the column NOT NULL so it's impossible
-- for a future ingest to add a resource without classifying it — general data
-- can never silently return. Run only once the table holds no null values.

alter table public.resources
  alter column veteran_relevance set not null;
