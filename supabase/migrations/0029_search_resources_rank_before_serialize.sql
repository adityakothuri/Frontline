-- Rank first, serialize last.
--
-- `search_resources` built `to_jsonb(r.*)` for EVERY row that passed the filters,
-- then ranked and limited. Browsing from ZIP 90210 meant serialising 13,689 rows
-- and sorting them (spilling to temp files) to return 242 — the other 98% of the
-- work was thrown away. Measured at 5,312ms, against an 8s client timeout
-- (`src/services/supabase/client.ts`); that thin margin is a prime suspect for
-- the "Something went wrong" card veterans were hitting on a cold open.
--
-- The rewrite ranks on cheap scalars (id, category, veteran_relevance, distance),
-- applies the limits, and only then joins back to `resources` to build the jsonb
-- for the survivors. Same signature, same semantics: verified position-for-position
-- identical to the previous function across every call shape the app sends —
-- browse-all, single category, in_person_only, lat/lng origin, no veteran_state,
-- and no origin at all. 5,312ms -> 719ms, and the temp-file spill is gone.

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
  scope as (
    select case
      when search_resources.veteran_state is null then null
      else 'state:' || upper(search_resources.veteran_state)
    end as state_tag
  ),
  -- Carries ids and ranking keys only. The row's jsonb is built at the very end,
  -- for the handful of rows that survive the limit.
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
