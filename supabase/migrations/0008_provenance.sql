-- Note: migration number 0007 was reserved and never used; 0006 → 0008 is intentional.
--
-- Frontline WS-7 — ingestion provenance & dedup (first source: VA Facilities).
--
-- Lets a machine ingest real resources without changing the READ contract:
-- `resources` stays read-only to anon, the client Resource shape is unchanged
-- (the new columns are nullable, so curated rows and the client mapping that
-- ignores unknown keys are both unaffected). Writes come only from the
-- service-role ingestion runner (ingestion/run.ts) — same trust boundary as
-- scripts/seed.ts. See [[Backend to Production Master Plan]] §WS-7.

-- ── Provenance columns on resources (all nullable; curated rows leave null) ──
alter table public.resources
  add column external_id text,      -- the provider's stable id, e.g. VA 'vha_691GE'
  add column source_provider text,  -- ingestion source key, e.g. 'va-facilities'; null = human-curated
  add column ingested_at date;      -- date this row was last fetched from its provider

-- Dedup key: at most one row per (provider, external_id). Partial so the many
-- curated rows (null provider) never collide. Re-ingestion targets resources by
-- its deterministic id (`va:<external_id>`); this index is defense-in-depth.
create unique index resources_provider_external_idx
  on public.resources (source_provider, external_id)
  where source_provider is not null;

-- ── Raw lineage: the untouched provider payload, one current row per fetch ───
-- For debugging and future re-normalization. Service-role only, like the other
-- backend tables — never exposed to the app.
create table public.resource_sources (
  id bigint generated always as identity primary key,
  provider text not null,
  external_id text not null,
  resource_id text references public.resources(id) on delete set null,
  fetched_at timestamptz not null default now(),
  raw jsonb not null,
  unique (provider, external_id)
);

alter table public.resource_sources enable row level security;
grant select, insert, update, delete on public.resource_sources to service_role;

-- Explicit deny-all to clients (matches the 0006 hardening pattern; states the
-- service-role-only intent in-schema and clears the rls_no_policy advisory).
create policy "deny all to clients" on public.resource_sources
  for all to anon, authenticated using (false) with check (false);
