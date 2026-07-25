-- Frontline — a radius means a radius: nothing outside it, ever.
--
-- Previously null-coordinate resources (national hotlines/referrals) passed the
-- radius filter unconditionally, so a radius search showed nationwide referrals
-- alongside local results. Decision 2026-07-24: every result shown must be
-- geographically WITHIN the search radius. When `radius_miles` is set, a row now
-- must be located AND within it; null-coord rows are excluded. When no radius is
-- given (radius_miles is null) behavior is unchanged — everything passes.
--
-- National referrals are still reachable in the app via the per-category
-- official-sources widget and the emergency crisis banner (neither is a
-- radius-scoped "result").
--
-- Same signature as 0017; keeps the bounding-box pre-filter and the
-- located-vs-referral cap partition.

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
      olat, olng,
      case when radius_miles is not null then radius_miles / 69.0 end as dlat,
      case when radius_miles is not null
           then radius_miles / (69.0 * greatest(cos(radians(olat)), 0.01)) end as dlng
    from (
      select
        coalesce(search_resources.lat,
          (select z.latitude from zip_centroids z where z.zip = search_resources.zip)) as olat,
        coalesce(search_resources.lng,
          (select z.longitude from zip_centroids z where z.zip = search_resources.zip)) as olng
    ) o
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
      -- Indexable bounding-box pre-filter (skips the trig for far rows).
      and (
        o.olat is null
        or search_resources.radius_miles is null
        or (r.latitude between o.olat - o.dlat and o.olat + o.dlat
            and r.longitude between o.olng - o.dlng and o.olng + o.dlng)
      )
      -- Strict radius: with a radius set, a row must be located AND within it.
      -- With no radius, everything (including null-coord referrals) passes.
      and (
        search_resources.radius_miles is null
        or (d.distance_miles is not null and d.distance_miles <= search_resources.radius_miles)
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
