-- Frontline — veteran-relevance classification.
--
-- Every resource in the app must be veteran-specific (exists to serve veterans)
-- or offer a concrete veteran benefit (GI Bill, VA/TRICARE, veterans' preference,
-- GPD/SSVF, DAV, etc.). This column is the honest label AND the guardrail: once
-- it's NOT NULL (migration 0012, after backfill + purge of general data), any
-- future ingest MUST classify a row or the insert fails — general-public data
-- can never silently return.
--
-- Added nullable here so existing rows can be backfilled / purged first.

alter table public.resources
  add column if not exists veteran_relevance text
  check (veteran_relevance in ('veteran_specific', 'veteran_benefit'));
