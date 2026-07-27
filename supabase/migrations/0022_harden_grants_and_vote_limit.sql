-- Frontline — defense-in-depth on the tables added after 0002, plus a rate
-- limit on the one write path the app can reach directly.
--
-- Why: 0001/0002 pair their RLS policies with explicit revokes, so `resources`
-- and `zip_centroids` are protected twice. Every table added from 0004 onward
-- relied on RLS alone, while Postgres/Supabase schema-default privileges still
-- left anon/authenticated holding INSERT/UPDATE/DELETE/TRUNCATE underneath. RLS
-- is doing the real work today, but a single accidental `disable row level
-- security` -- a bad migration, a dashboard toggle -- would make these tables
-- publicly writable with nothing behind it. These revokes are that backstop.
--
-- None of these tables is read by the app: it queries `resources` and
-- `zip_centroids` and calls RPCs. The edge functions reach the backup, spend,
-- and rate-limit tables with the service role, which is unaffected by revokes.

revoke all on public.rate_limits from anon, authenticated;
revoke all on public.saved_backups from anon, authenticated;
revoke all on public.profile_backups from anon, authenticated;
revoke all on public.ai_spend from anon, authenticated;
revoke all on public.resource_sources from anon, authenticated;
revoke all on public.resource_votes from anon, authenticated;
revoke all on public.geocode_cache from anon, authenticated;

-- 0003 documents this curator view as "deliberately NOT granted to anon", but
-- the schema default granted SELECT anyway. It leaks no resource rows anon
-- can't already read, but it does expose curation status, and the code comment
-- should be true.
revoke all on public.resources_needing_review from anon, authenticated;

-- The two intentionally-public tables keep SELECT and nothing else. 0001/0002
-- revoked insert/update/delete but not TRUNCATE, TRIGGER or REFERENCES, which
-- the schema default still granted. TRUNCATE matters most: RLS does not apply
-- to it, so the read-only policy would not have stopped one. PostgREST exposes
-- no TRUNCATE verb, so this was not reachable from the app's anon key -- but a
-- grant that only a missing feature makes safe is not a control.
revoke all on public.resources from anon, authenticated;
grant select on public.resources to anon, authenticated;

revoke all on public.zip_centroids from anon, authenticated;
grant select on public.zip_centroids to anon, authenticated;

-- --------------------------------------------------------------------------
-- Rate-limit vote submission.
--
-- submit_resource_vote is SECURITY DEFINER and granted to anon, so it is called
-- straight against PostgREST -- outside both edge functions, and therefore
-- outside the only two rate limiters in the system. The primary key already
-- caps a device at one vote per resource, but nothing bounded how fast a
-- caller could churn writes.
--
-- This reuses the existing rate_limits table with a "vote:" prefix so vote
-- traffic gets its own bucket, keyed by device. Honest about the residual: a
-- caller that mints fresh UUIDs still gets a fresh bucket each time. Closing
-- that needs the trusted-hop IP limiting the edge functions already do, which
-- means moving votes behind a function -- deliberately not attempted here.
-- --------------------------------------------------------------------------

create or replace function public.submit_resource_vote(
  p_device_id uuid,
  p_resource_id text,
  p_vote text
)
returns table (helpful int, not_helpful int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_vote not in ('up', 'down') then
    raise exception 'vote must be up or down';
  end if;

  -- Generous: a real veteran rates a handful of resources in a sitting.
  v_count := public.increment_rate_limit('vote:' || p_device_id::text);
  if v_count > 60 then
    raise exception 'rate limit exceeded' using errcode = '53400';
  end if;

  insert into public.resource_votes (device_id, resource_id, vote)
  values (p_device_id, p_resource_id, p_vote)
  on conflict (device_id, resource_id)
  do update set vote = excluded.vote, updated_at = now();

  return query select * from public.get_resource_rating(p_resource_id);
end;
$$;

grant execute on function public.submit_resource_vote(uuid, text, text) to anon, authenticated;
