-- Frontline — bounding-box pre-filter so search scales past 100k rows.
--
-- With food data (~116k rows) the "all categories" browse timed out (57014):
-- search_resources computed haversine for EVERY located row before filtering by
-- radius. Fix: when an origin + radius are given, pre-filter located rows to a
-- lat/lng bounding box (a cheap, indexable superset of the search circle) before
-- the trig runs. The exact haversine + radius check still trims the box corners,
-- so results are identical — just fast. Null-coord referrals bypass the box
-- (they have no location) and are capped separately as before.

create index if not exists resources_lat_lng_idx
  on public.resources (latitude, longitude);

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
      -- Degrees of lat/lng that cover the radius (1° lat ≈ 69 mi; lng shrinks
      -- with latitude). cos is safe for US latitudes; clamp so it never divides
      -- by ~0 near the poles.
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
      -- Indexable bounding-box pre-filter: skip the trig for far-away rows.
      -- Bypassed when there's no origin/radius, and always kept for null-coord
      -- referrals (they have no location to box).
      and (
        o.olat is null
        or search_resources.radius_miles is null
        or r.latitude is null
        or (r.latitude between o.olat - o.dlat and o.olat + o.dlat
            and r.longitude between o.olng - o.dlng and o.olng + o.dlng)
      )
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
