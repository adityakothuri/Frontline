-- Frontline Phase 10 — the one search RPC serving both ResourceService.search()
-- (radius + categories) and listResources() (browse: null radius/categories).
--
-- Product semantics mirrored from the mock (the executable spec,
-- src/services/resources/mockResourceService.ts):
--   * resources with null coords (crisis lines) always pass the radius filter;
--   * in_person_only excludes them;
--   * unknown/absent origin -> null distances and NO radius filter — never a
--     fake city center.
-- Sorting is intentionally minimal (distance, stable) — the client owns the
-- explainable ordering because it depends on client-computed open-now state.

-- Pure math; must stay executable by anon because search_resources is
-- SECURITY INVOKER (the caller's role executes everything inside).
create or replace function public.haversine_miles(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable
set search_path = public
as $$
  select 3958.8 * 2 * asin(sqrt(
    pow(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
    * pow(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- Argument names are the PostgREST API contract (JSON body keys of
-- POST /rest/v1/rpc/search_resources) — never rename casually.
create or replace function public.search_resources(
  zip text default null,
  lat double precision default null,
  lng double precision default null,
  radius_miles double precision default null,
  categories text[] default null,
  in_person_only boolean default false
) returns table (resource jsonb, distance_miles double precision)
language sql stable
set search_path = public
as $$
  with origin as (
    select
      coalesce(search_resources.lat,
        (select z.latitude from zip_centroids z where z.zip = search_resources.zip)) as olat,
      coalesce(search_resources.lng,
        (select z.longitude from zip_centroids z where z.zip = search_resources.zip)) as olng
  )
  select
    to_jsonb(r.*) as resource,
    d.distance_miles
  from resources r
  cross join origin o
  cross join lateral (
    select case
      when o.olat is not null and r.latitude is not null
      then haversine_miles(o.olat, o.olng, r.latitude, r.longitude)
    end as distance_miles
  ) d
  where (search_resources.categories is null or r.category = any (search_resources.categories))
    and (not search_resources.in_person_only or r.latitude is not null)
    and (
      search_resources.radius_miles is null
      or d.distance_miles is null
      or d.distance_miles <= search_resources.radius_miles
    )
  order by d.distance_miles nulls last, r.id
$$;

grant execute on function public.haversine_miles to anon, authenticated;
grant execute on function public.search_resources to anon, authenticated;

-- Curator surface (dashboard / future admin script — deliberately NOT granted
-- to anon). 90 days matches the client's isStale threshold in
-- src/features/resources/resourceStatus.ts; change both together.
create view public.resources_needing_review
  with (security_invoker = true) as
  select id, name, category, verification_status, last_checked
  from public.resources
  where last_checked < current_date - interval '90 days'
     or verification_status <> 'verified';
