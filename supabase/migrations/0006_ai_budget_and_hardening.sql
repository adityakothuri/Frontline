-- Frontline — AI hourly spend budget + backup-table policy hardening.
--
-- Budget: a GLOBAL (all-callers, not per-IP) hourly USD cap on Claude spend,
-- enforced by the `ai` edge function. This is the APP-LEVEL soft guard — at the
-- limit the function returns 429 and the client degrades to templated AI. The
-- HARD backstop is the spend cap configured in the Anthropic console; the two
-- are layered on purpose (graceful degradation here, absolute ceiling there).
--
-- Hardening: explicit deny-all policies make the "service-role only" intent of
-- the backup/limit tables explicit in-schema. They were already deny-all (RLS
-- on + no policy = deny everyone; service_role bypasses RLS via its grants);
-- this states the intent and clears the linter's rls_enabled_no_policy notice.

-- ── AI spend ledger ─────────────────────────────────────────────────────────
create table public.ai_spend (
  window_start timestamptz primary key,   -- truncated to the hour
  spend_usd double precision not null default 0
);

alter table public.ai_spend enable row level security;
grant select, insert, update, delete on public.ai_spend to service_role;

-- Current hour's accumulated spend (0 when the window has no row yet).
create or replace function public.current_ai_spend()
returns double precision
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select spend_usd from ai_spend where window_start = date_trunc('hour', now())),
    0
  )
$$;

-- Atomically add to the current hour's spend and return the new total. Also
-- opportunistically purges spend + rate-limit windows older than 3 hours so
-- neither table grows unbounded — no pg_cron dependency, runs on every AI call.
create or replace function public.add_ai_spend(p_usd double precision)
returns double precision
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total double precision;
begin
  insert into ai_spend (window_start, spend_usd)
  values (date_trunc('hour', now()), p_usd)
  on conflict (window_start)
  do update set spend_usd = ai_spend.spend_usd + p_usd
  returning spend_usd into new_total;

  delete from ai_spend    where window_start < now() - interval '3 hours';
  delete from rate_limits where window_start < now() - interval '3 hours';

  return new_total;
end
$$;

revoke execute on function public.current_ai_spend() from public, anon, authenticated;
revoke execute on function public.add_ai_spend(double precision) from public, anon, authenticated;
grant execute on function public.current_ai_spend() to service_role;
grant execute on function public.add_ai_spend(double precision) to service_role;

-- ── Explicit deny-all on service-role-only tables ───────────────────────────
create policy "deny all to clients" on public.rate_limits
  for all to anon, authenticated using (false) with check (false);
create policy "deny all to clients" on public.saved_backups
  for all to anon, authenticated using (false) with check (false);
create policy "deny all to clients" on public.profile_backups
  for all to anon, authenticated using (false) with check (false);
create policy "deny all to clients" on public.ai_spend
  for all to anon, authenticated using (false) with check (false);
