-- Frontline Phase 10 — ZIP (ZCTA) centroids for server-side ZIP -> origin
-- resolution. Source: US Census 2024 Gazetteer (supabase/seed-data/
-- zcta_centroids.csv, loaded by scripts/seed.ts). No geocoding API needed.

create table public.zip_centroids (
  zip text primary key,
  latitude double precision not null,
  longitude double precision not null
);

-- search_resources runs as SECURITY INVOKER, so the anon role reads this table
-- directly — it needs its own select policy or distances silently come back null.
alter table public.zip_centroids enable row level security;

create policy "anon can read zip centroids"
  on public.zip_centroids for select
  to anon, authenticated
  using (true);

grant select on public.zip_centroids to anon, authenticated;
revoke insert, update, delete on public.zip_centroids from anon, authenticated;
