-- Frontline — strict radius, but keep location-less VETERAN referrals, fast.
--
-- Final form of search_resources (supersedes the RPC in 0019). Located rows are
-- strictly within the search radius (nothing beyond it, and rows with an
-- address but no coordinates are dropped — we can't verify they're in range).
-- Veteran resources with NO pinpoint (null coords AND null address, veteran) —
-- SSVF providers, crisis/benefit hotlines — are KEPT regardless of radius so the
-- app can show them in a separate "Statewide & national veteran help" section
-- (the client state-filters SSVF via `state:XX` tags). General no-coord rows
-- never appear.
--
-- Split located-vs-referral so each half uses its index: `located` range-scans
-- resources_category_lat_lng_idx; `referral` is a small null-coord scan. (An
-- earlier single-CTE form that computed the referral flag over every row forced
-- a full scan and timed out on the 7.7k legal rows.)

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
  located as (
    select
      to_jsonb(r.*) as resource,
      d.distance_miles,
      r.id as rid,
      r.category,
      r.veteran_relevance,
      false as is_referral
    from resources r
    cross join origin o
    cross join lateral (
      select case
        when o.olat is not null then haversine_miles(o.olat, o.olng, r.latitude, r.longitude)
      end as distance_miles
    ) d
    where r.latitude is not null
      and (search_resources.categories is null or r.category = any (search_resources.categories))
      and (
        o.olat is null
        or search_resources.radius_miles is null
        or (r.latitude between o.olat - o.dlat and o.olat + o.dlat
            and r.longitude between o.olng - o.dlng and o.olng + o.dlng)
      )
      and (
        search_resources.radius_miles is null
        or (d.distance_miles is not null and d.distance_miles <= search_resources.radius_miles)
      )
  ),
  referral as (
    select
      to_jsonb(r.*) as resource,
      null::double precision as distance_miles,
      r.id as rid,
      r.category,
      r.veteran_relevance,
      true as is_referral
    from resources r
    where r.latitude is null
      and r.address is null
      and r.veteran_relevance <> 'general'
      and not search_resources.in_person_only
      and (search_resources.categories is null or r.category = any (search_resources.categories))
  ),
  combined as (select * from located union all select * from referral),
  ranked as (
    select c.*,
      row_number() over (
        partition by c.category, c.is_referral
        order by (c.veteran_relevance = 'general') asc, c.distance_miles, c.rid
      ) as rn
    from combined c
  )
  select resource, distance_miles
  from ranked m
  where m.is_referral
     or search_resources.per_category_limit is null
     or m.rn <= search_resources.per_category_limit
  order by m.distance_miles nulls last, m.rid
$$;

grant execute on function public.search_resources to anon, authenticated;
