-- Make search_resources fast on a cold, small instance — and do the result
-- capping where the rows are, not on the phone.
--
-- Four changes, all measured against production (252,665 rows, ~1 GB compute,
-- anon statement_timeout 3s):
--
-- 1. No origin + a radius used to walk the whole table.
--    0036 widened the box to the globe when there was no origin. With a radius
--    still set, every located row is then thrown away by the distance guard (its
--    distance is NULL) — but only after all ~249k of them were visited. Measured
--    9,811 ms, so anon's 3s timeout killed it and the client retried twice: a
--    guaranteed ~10s "Something went wrong" for anyone without a ZIP. Now that
--    case gets an empty box (latmin > latmax), a zero-row index probe. The rows
--    returned are identical (referrals only).
--
-- 2. haversine_miles could not be inlined.
--    A SQL function with a SET clause is never inlined, and each call pays a
--    settings save/restore — 56.5 ms vs 6.2 ms over the same 4,024-row box. It
--    only touches pg_catalog math, so dropping `set search_path` carries no
--    search-path risk. Inlining also needs plain column arguments, so the ZIP
--    centroid is now joined rather than read through scalar subqueries.
--
-- 3. Two indexes the planner should not have.
--    resources_lat_lng_idx is the same key as resources_geo_rank_idx without the
--    INCLUDE columns. Because the box bounds come from subqueries, the planner
--    estimates a handful of rows and picks the smaller, non-covering one — a heap
--    visit per row (3,941 buffers vs 333 for the covering index on the same box).
--    resources_category_lat_lng_idx has never been scanned. Both go.
--
-- 4. The dense-general and uncontactable caps move server-side.
--    They used to run in supabaseResourceService after the full payload arrived
--    (386 kB for a browse), discarding a large share of it. Same rules, same
--    numbers, applied in distance order:
--      * general rows in food/housing/healthcare/clothing: nearest 20 per category
--      * rows with neither phone nor website: 5 per category
--    The client keeps browseCountCap's mirror of the 20 for the "20+" label.
--
-- Signature and return shape are unchanged.

drop index if exists public.resources_lat_lng_idx;
drop index if exists public.resources_category_lat_lng_idx;

create or replace function public.haversine_miles(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql
immutable
parallel safe
as $$
  select 3958.8 * 2 * asin(sqrt(
    pow(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
    * pow(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

create or replace function public.search_resources(
  zip text default null,
  lat double precision default null,
  lng double precision default null,
  radius_miles double precision default null,
  categories text[] default null,
  in_person_only boolean default false,
  per_category_limit integer default null,
  veteran_state text default null,
  referral_limit integer default 6
)
returns table(resource jsonb, distance_miles double precision)
language sql
stable
set search_path to 'public'
as $function$
  with origin as (
    select
      olat, olng,
      -- Three cases, every one finite so the `located` predicates stay ANDable:
      --   origin + radius   -> the real box
      --   radius, no origin -> an empty box (no row can be within a radius of
      --                        nowhere; 0036 walked the whole table to learn that)
      --   no radius         -> the whole globe
      case when search_resources.radius_miles is null then -90
           when olat is null then 1
           else olat - dlat end as latmin,
      case when search_resources.radius_miles is null then 90
           when olat is null then 0
           else olat + dlat end as latmax,
      case when search_resources.radius_miles is null or olat is null then -180
           else olng - dlng end as lngmin,
      case when search_resources.radius_miles is null or olat is null then 180
           else olng + dlng end as lngmax
    from (
      select
        olat, olng,
        search_resources.radius_miles / 69.0 as dlat,
        search_resources.radius_miles / (69.0 * greatest(cos(radians(olat)), 0.01)) as dlng
      -- A join, not scalar subqueries: a subquery argument stops the planner
      -- inlining haversine_miles (each call then costs ~26 µs, 167 ms per browse).
      from (
        select
          coalesce(search_resources.lat, z.latitude) as olat,
          coalesce(search_resources.lng, z.longitude) as olng
        from (select 1) one
        left join zip_centroids z on z.zip = search_resources.zip
      ) o
    ) b
  ),
  scope as (
    select case
      when search_resources.veteran_state is null then null
      else 'state:' || upper(search_resources.veteran_state)
    end as state_tag
  ),
  located as (
    select
      d.distance_miles,
      r.id as rid,
      r.category,
      r.veteran_relevance,
      false as is_referral,
      false as state_match
    from resources r
    cross join origin o
    cross join lateral (
      select case
        when o.olat is not null then haversine_miles(o.olat, o.olng, r.latitude, r.longitude)
      end as distance_miles
    ) d
    where r.latitude between o.latmin and o.latmax
      and r.longitude between o.lngmin and o.lngmax
      and (search_resources.categories is null or r.category = any (search_resources.categories))
      and (search_resources.radius_miles is null or d.distance_miles <= search_resources.radius_miles)
  ),
  referral as (
    select
      null::double precision as distance_miles,
      r.id as rid,
      r.category,
      r.veteran_relevance,
      true as is_referral,
      (s.state_tag is not null and r.tags @> array[s.state_tag]) as state_match
    from resources r
    cross join scope s
    where r.latitude is null
      and r.address is null
      and r.veteran_relevance <> 'general'
      and not search_resources.in_person_only
      and (search_resources.categories is null or r.category = any (search_resources.categories))
      and (
        s.state_tag is null
        or r.tags @> array[s.state_tag]
        or not exists (select 1 from unnest(r.tags) t where t like 'state:%')
      )
  ),
  combined as (select * from located union all select * from referral),
  ranked as (
    select c.*,
      row_number() over (
        partition by c.category, c.is_referral, c.state_match
        order by (c.veteran_relevance = 'general') asc,
                 c.distance_miles,
                 c.rid
      ) as rn
    from combined c
  ),
  kept as (
    select m.rid, m.distance_miles
    from ranked m
    where case
      when m.is_referral then
        search_resources.referral_limit is null or m.rn <= search_resources.referral_limit
      else
        search_resources.per_category_limit is null or m.rn <= search_resources.per_category_limit
    end
  ),
  -- Dense general data (pantries, HUD counselors, community health centres,
  -- thrift shops) keeps only its nearest 20 per category, so a veteran feed
  -- never fills with it. Veteran rows in the same categories are untouched.
  dense_capped as (
    select k.rid, k.distance_miles, r.category,
      r.phone is null and r.website is null as uncontactable,
      r.veteran_relevance = 'general'
        and r.category in ('food', 'housing', 'healthcare', 'clothing') as dense_general,
      row_number() over (
        partition by r.category,
          r.veteran_relevance = 'general'
            and r.category in ('food', 'housing', 'healthcare', 'clothing')
        order by k.distance_miles nulls last, k.rid
      ) as dense_rn
    from kept k
    join resources r on r.id = k.rid
  ),
  -- A place a veteran cannot phone or look up is worth knowing about when it is
  -- round the corner, but no more than 5 per category may bury the ones that
  -- answer. Counted after the dense cap, as the client did.
  contact_capped as (
    select dc.rid, dc.distance_miles, dc.uncontactable,
      row_number() over (
        partition by dc.category, dc.uncontactable
        order by dc.distance_miles nulls last, dc.rid
      ) as contact_rn
    from dense_capped dc
    where not dc.dense_general or dc.dense_rn <= 20
  )
  select to_jsonb(r.*) as resource, cc.distance_miles
  from contact_capped cc
  join resources r on r.id = cc.rid
  where not cc.uncontactable or cc.contact_rn <= 5
  order by cc.distance_miles nulls last, cc.rid
$function$;

analyze resources;
