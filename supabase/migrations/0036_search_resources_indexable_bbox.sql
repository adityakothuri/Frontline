-- Make the search_resources bounding box index-usable.
--
-- The `located` CTE guarded its bounding box with a disjunction:
--
--   and (o.olat is null or radius_miles is null
--        or (r.latitude between … and r.longitude between …))
--
-- An OR can never become an index condition, so every call seq-scanned all
-- ~128k rows and ran haversine_miles on each one. Measured warm on production,
-- before this migration:
--
--   browse-all + ZIP  (categories null, the Discover/Map default)   4,949 ms
--   browse-all, no ZIP                                              1,444 ms
--   single category  (['legal'])                                      109 ms
--
-- The browse-all path is what Discover and Map open on, which is why a cold
-- launch — DNS, TLS and a cold buffer cache on top of five seconds of query —
-- routinely blew the client's 8s timeout and dropped the veteran on
-- "Something went wrong".
--
-- The fix is to give `origin` finite bounds in every case: the real box when
-- there is an origin and a radius, the whole globe when there isn't. The
-- predicates in `located` then become plain ANDs, and the planner uses
-- resources_lat_lng_idx (an Index Only Scan, thanks to 0030's covering index).
--
-- Measured after, same rows returned in every case:
--
--   browse-all + ZIP                                    4,949 ms ->   64 ms
--   browse-all, no ZIP but a radius (what the app sends) 1,444 ms ->  189 ms
--   single category                                        109 ms ->   22 ms
--
-- The one case that does not improve is no ZIP *and* no radius (1.5 s): with no
-- origin there is no box to exploit, and the window function has to rank all
-- ~124k located rows. The app never sends it — listResources always passes a
-- radius (DEFAULT_RADIUS_MILES) — so it stays a theoretical path.
--
-- Signature and return shape are unchanged; no client change accompanies this.
--
-- Two things deliberately left alone:
--
--   * `r.latitude between -90 and 90` also drops NULL latitudes, so the old
--     explicit `r.latitude is not null` is redundant and is gone.
--   * The distance guard keeps its `radius_miles is null or …` form. It is a
--     post-filter on a computed value, so it costs nothing at the index level,
--     and its NULL semantics are load-bearing: with no origin but a radius set,
--     `d.distance_miles` is NULL and every located row is correctly excluded
--     (the call then returns referrals only). Folding it into a coalesce would
--     silently start returning the entire table for that case.

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
      -- Finite in every case, so the `located` predicates stay ANDable. Without
      -- an origin or a radius the box is the whole globe, which is exactly the
      -- "no spatial filter" the old OR was reaching for.
      case when olat is not null and search_resources.radius_miles is not null
           then olat - dlat else -90 end as latmin,
      case when olat is not null and search_resources.radius_miles is not null
           then olat + dlat else 90 end as latmax,
      case when olat is not null and search_resources.radius_miles is not null
           then olng - dlng else -180 end as lngmin,
      case when olat is not null and search_resources.radius_miles is not null
           then olng + dlng else 180 end as lngmax
    from (
      select
        olat, olng,
        case when search_resources.radius_miles is not null
             then search_resources.radius_miles / 69.0 end as dlat,
        case when search_resources.radius_miles is not null
             then search_resources.radius_miles / (69.0 * greatest(cos(radians(olat)), 0.01)) end as dlng
      from (
        select
          coalesce(search_resources.lat,
            (select z.latitude from zip_centroids z where z.zip = search_resources.zip)) as olat,
          coalesce(search_resources.lng,
            (select z.longitude from zip_centroids z where z.zip = search_resources.zip)) as olng
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
      and (
        search_resources.radius_miles is null
        or (d.distance_miles is not null and d.distance_miles <= search_resources.radius_miles)
      )
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
  )
  select to_jsonb(r.*) as resource, k.distance_miles
  from kept k
  join resources r on r.id = k.rid
  order by k.distance_miles nulls last, k.rid
$function$;

analyze resources;
