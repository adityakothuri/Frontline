-- Frontline — veteran-first capacity in the per-category cap.
--
-- With general resources admitted (0013), the per-category limit must never
-- let a general row evict a veteran row from results: the window that picks
-- the N rows per category now fills veteran rows first, then general, each
-- nearest-first. The final display order stays distance-first — a veteran who
-- needs food today cares about the nearest open pantry — so veteran-first is
-- about capacity, not shuffling the visible sort.
--
-- Same signature as 0010, so create-or-replace is enough (no drop needed).

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
        order by
          (r.veteran_relevance = 'general') asc,
          d.distance_miles nulls last,
          r.id
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
