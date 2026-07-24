-- Frontline Phase 10 — coarse per-IP rate limiting for the AI edge function.
-- No user accounts exist (privacy by default), so this is an hourly fixed
-- window keyed by hashed IP. Generous on purpose (shared CGNAT IPs); the hard
-- cost bound is the function's max_tokens x model price.

create table public.rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (ip_hash, window_start)
);

alter table public.rate_limits enable row level security;
-- No policies: only the service role (used inside the edge function) touches
-- this table; it is never exposed to app clients.
grant select, insert, update, delete on public.rate_limits to service_role;

-- Atomic bump-and-read for the current hourly window. SECURITY DEFINER is safe
-- here: execution is granted to service_role only.
create or replace function public.increment_rate_limit(p_ip_hash text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into rate_limits (ip_hash, window_start, count)
  values (p_ip_hash, date_trunc('hour', now()), 1)
  on conflict (ip_hash, window_start)
  do update set count = rate_limits.count + 1
  returning count
$$;

revoke execute on function public.increment_rate_limit from public, anon, authenticated;
grant execute on function public.increment_rate_limit to service_role;
