-- Frontline — balance results across categories.
--
-- Some categories are naturally huge (healthcare ~38k) and others small (jobs,
-- legal), so an unbounded browse/map floods the screen with one category and is
-- slow. This adds an optional `per_category_limit`: keep only the N NEAREST
-- resources per category (a window function), so the map/browse stays balanced
-- and fast. No data is deleted — this is a query-time cap. When the param is
-- null the behavior is unchanged (every match).
--
-- The arg list changes, so we drop the old signature first (a new param would
-- otherwise create an overload PostgREST can't disambiguate).

drop function if exists public.search_resources(
  text, double precision, double precision, double precision, text[], boolean
);

create or replace function public.search_resources(
  zip text default null,
  lat double precision default null,
  lng double precision default null,
  radius_miles double precision default null,
  categories text[] default null,
  in_person_only boolean default false,
  per_category_limit int default null
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
  ),
  matched as (
    select
      to_jsonb(r.*) as resource,
      d.distance_miles,
      r.id as rid,
      row_number() over (
        partition by r.category
        order by d.distance_miles nulls last, r.id
      ) as rn
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
  )
  select resource, distance_miles
  from matched
  where search_resources.per_category_limit is null
     or rn <= search_resources.per_category_limit
  order by distance_miles nulls last, rid
$$;

grant execute on function public.search_resources to anon, authenticated;
