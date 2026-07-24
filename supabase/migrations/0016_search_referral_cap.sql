-- Frontline — referrals get their own small cap, not the category's whole cap.
--
-- Null-distance rows (national hotlines, SSVF intake lines) always pass the
-- radius filter, and under 0014 they consumed the per-category cap veteran-rows
-- first — so 235 null-coord SSVF housing rows locked every located HUD
-- counseling row out of the housing results nationwide, and the client's
-- "National help lines" strip became a wall of out-of-state intake lines.
--
-- Fix: partition the cap by located-vs-not. Located rows use the full
-- per_category_limit (veteran-first, nearest-first — unchanged). Unlocated
-- rows get at most 3 slots per category, veteran rows first, then by
-- source_provider ('curated-national' sorts before 'ssvf-providers', so the
-- true national hotlines win the strip) and id. No cap requested = unchanged.

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
        partition by r.category, (d.distance_miles is null)
        order by
          (r.veteran_relevance = 'general') asc,
          d.distance_miles,
          r.source_provider,
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
  from matched m
  where search_resources.per_category_limit is null
     or (m.distance_miles is not null and m.rn <= search_resources.per_category_limit)
     or (m.distance_miles is null and m.rn <= least(search_resources.per_category_limit, 3))
  order by m.distance_miles nulls last, m.rid
$$;

grant execute on function public.search_resources to anon, authenticated;
