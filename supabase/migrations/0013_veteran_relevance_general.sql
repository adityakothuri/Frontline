-- Frontline — hybrid relevance: admit clearly-labeled general resources.
--
-- The strict veteran-only rule (0011/0012) left 7 of 11 categories with only
-- national hotlines — a veteran searching "food" or "legal" near them found
-- nothing local. Decision (2026-07-23, supersedes the 2026-07-22 strict rule):
-- veteran resources always come first, but thin categories may be backfilled
-- with high-quality general sources (legal aid, housing counseling, food
-- pantries) labeled "Open to everyone" in the UI. The column stays NOT NULL —
-- every ingest still must classify, nothing enters unlabeled.

alter table public.resources
  drop constraint if exists resources_veteran_relevance_check;

alter table public.resources
  add constraint resources_veteran_relevance_check
  check (veteran_relevance in ('veteran_specific', 'veteran_benefit', 'general'));
