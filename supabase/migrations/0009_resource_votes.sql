-- Frontline — real community ratings (replaces the removed simulated rating).
-- A veteran leaves a thumbs up/down on a resource; the app shows the real
-- aggregate ("N found this helpful"), which is 0 until people vote. Keyed to the
-- same anonymous device UUID used by backup sync — no login, no PII.
--
-- The table is DENY-ALL to the app (RLS on, no anon policies). All access goes
-- through two SECURITY DEFINER functions so the anon client can submit a vote
-- and read counts, but can never read who voted or write arbitrary rows.

create table if not exists public.resource_votes (
  device_id uuid not null,
  resource_id text not null references public.resources (id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (device_id, resource_id)
);

-- The aggregate is grouped by resource_id, so index it (the PK leads with device_id).
create index if not exists resource_votes_resource_idx on public.resource_votes (resource_id);

alter table public.resource_votes enable row level security;
-- No anon/authenticated policies: the table is unreachable except through the
-- definer functions below. Service role keeps full access for maintenance.
grant select, insert, update, delete on public.resource_votes to service_role;

-- Read the public aggregate for one resource. Returns a single row of counts
-- (0/0 when nobody has voted). No per-voter data is exposed.
create or replace function public.get_resource_rating(p_resource_id text)
returns table (helpful int, not_helpful int)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(count(*) filter (where vote = 'up'), 0)::int,
    coalesce(count(*) filter (where vote = 'down'), 0)::int
  from public.resource_votes
  where resource_id = p_resource_id;
$$;

-- Upsert this device's single vote for a resource (changing an existing vote
-- overwrites it), then return the updated aggregate. One vote per device per
-- resource is enforced by the primary key.
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
begin
  if p_vote not in ('up', 'down') then
    raise exception 'vote must be up or down';
  end if;

  insert into public.resource_votes (device_id, resource_id, vote)
  values (p_device_id, p_resource_id, p_vote)
  on conflict (device_id, resource_id)
  do update set vote = excluded.vote, updated_at = now();

  return query select * from public.get_resource_rating(p_resource_id);
end;
$$;

-- The anon client may call both functions; it still cannot touch the table.
grant execute on function public.get_resource_rating(text) to anon, authenticated;
grant execute on function public.submit_resource_vote(uuid, text, text) to anon, authenticated;
