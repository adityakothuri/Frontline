-- Frontline — Census geocode result cache.
--
-- GI Bill schools (and any future source with addresses but no provider
-- coordinates) are geocoded through the free US Census batch geocoder during
-- ingestion. Results are cached here keyed by normalized address so re-runs
-- never re-submit ~12k addresses. Misses are cached too (matched=false,
-- null coords) so known-bad addresses aren't retried every run.
--
-- Ingestion-only plumbing: service role reads/writes it; the app never does.

create table public.geocode_cache (
  address_key text primary key,
  latitude double precision,
  longitude double precision,
  matched boolean not null,
  geocoded_at date not null,
  constraint geocode_coords_match check (
    (matched and latitude is not null and longitude is not null)
    or (not matched and latitude is null and longitude is null)
  )
);

alter table public.geocode_cache enable row level security;
-- No policies on purpose: anon/authenticated get nothing; the service role
-- bypasses RLS. Belt and braces:
revoke all on public.geocode_cache from anon, authenticated;
