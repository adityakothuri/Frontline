-- Frontline — scope and cap statewide referrals server-side.
--
-- WHY
--
-- The second data audit (2026-07-28) found that all 14,316 `vso-organizations`
-- rows — 64% of the entire veteran catalogue — had NO street address. The
-- adapter placed each one at its ZIP centroid, so the app drew a map pin and
-- printed a confident "2.4 mi" for a location that does not exist, and
-- Directions routed to the geometric centre of a ZIP code.
--
-- The fix (see ingestion/sources/vsoOrganizations.ts) stops inventing
-- coordinates and collapses those rows to one per organization × state, which
-- is the granularity the OGC export actually supports. They become referrals:
-- null coords, null address, `state:XX` tag — the shape `isNationalReferral`
-- already recognises.
--
-- That exposes two problems in this RPC that 251 referral rows never surfaced:
--
--   1. NO CAP. Line 97 of 0021 reads `where m.is_referral or ...`, so every
--      matching referral is returned and the per-category limit applies only to
--      located rows. Fine at 251 rows; a mobile client should not download
--      ~1,200 of them on every search.
--   2. NO STATE AWARENESS. Referral rank falls back to `order by rid` (all
--      distances are null), and the state filter lives on the client in
--      `filterReferralsByState`. So the server would ship a payload of mostly
--      out-of-state rows for the client to throw away — and with a cap added,
--      capping *before* the state filter would leave a veteran with nothing.
--
-- So the state filter moves server-side, next to the cap that needs it. The
-- client keeps `filterReferralsByState` as-is: it is still the authority when
-- the caller does not pass a state, and defence in depth costs nothing here.
--
-- WHAT CHANGED vs 0021
--
--   * new arg `veteran_state text` — the caller's 2-letter state, from
--     `stateFromZip()`. Null keeps the old unfiltered behaviour.
--   * new arg `referral_limit int default 6` — per-category cap on referrals.
--   * `referral` CTE drops rows tagged for a DIFFERENT state; untagged
--     (national) referrals always survive.
--   * `state_match` sorts state-specific referrals above national ones, so a
--     veteran sees their own state's organizations before generic hotlines.
--   * referrals now honour a cap instead of bypassing it.
--
-- The `located` half is unchanged, including the bbox pre-filter from 0017 that
-- keeps resources_category_lat_lng_idx in play.

-- Adding two defaulted arguments does NOT replace the 7-arg function from 0021 —
-- Postgres keys functions on their argument list, so `create or replace` would
-- leave both in place and every existing 7-argument call would fail as
-- ambiguous. 0010 hit exactly this when it dropped the 6-arg overload. Drop the
-- old signature explicitly, before creating the new one.
drop function if exists public.search_resources(
  text, double precision, double precision, double precision, text[], boolean, int
);

create function public.search_resources(
  zip text default null,
  lat double precision default null,
  lng double precision default null,
  radius_miles double precision default null,
  categories text[] default null,
  in_person_only boolean default false,
  per_category_limit int default null,
  veteran_state text default null,
  referral_limit int default 6
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
  scope as (
    select case
      when search_resources.veteran_state is null then null
      else 'state:' || upper(search_resources.veteran_state)
    end as state_tag
  ),
  located as (
    select
      to_jsonb(r.*) as resource,
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
      to_jsonb(r.*) as resource,
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
      -- Drop referrals scoped to another state. An untagged referral is
      -- national and always survives; when the caller's state is unknown we
      -- cannot judge, so nothing is dropped (the client still filters).
      and (
        s.state_tag is null
        or r.tags @> array[s.state_tag]
        or not exists (select 1 from unnest(r.tags) t where t like 'state:%')
      )
  ),
  combined as (select * from located union all select * from referral),
  ranked as (
    select c.*,
      -- `state_match` is in the PARTITION, not the ORDER BY, and that distinction
      -- is load-bearing. Ordering by it instead lets a state's own referrals
      -- consume the entire `referral_limit` budget and evict every national one:
      -- measured on the live table, a California `legal` search returned six LSC
      -- California rows and ZERO curated nationals, dropping `stateside-legal`
      -- and the VA accredited-representative search; a Rhode Island
      -- `benefits_help` search evicted `curated:va-benefits-hotline`, the VA's
      -- main benefits number. Those 16 curated rows are the hand-verified
      -- fallback layer, and they matter most in exactly the case the cap was
      -- hitting them — when a veteran has fewer than three local results and
      -- `splitLocalsAndReferrals` leads with referrals.
      --
      -- Partitioning gives state referrals and national referrals a budget each.
      -- Located rows are unaffected: `state_match` is the literal `false` there,
      -- so their partition is unchanged.
      row_number() over (
        partition by c.category, c.is_referral, c.state_match
        order by (c.veteran_relevance = 'general') asc,
                 c.distance_miles,
                 c.rid
      ) as rn
    from combined c
  )
  select resource, distance_miles
  from ranked m
  where case
    when m.is_referral then
      search_resources.referral_limit is null or m.rn <= search_resources.referral_limit
    else
      search_resources.per_category_limit is null or m.rn <= search_resources.per_category_limit
  end
  order by m.distance_miles nulls last, m.rid
$$;

grant execute on function public.search_resources to anon, authenticated;
