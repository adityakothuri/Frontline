-- Frontline Phase 10 slice 2 — server-side backup of the veteran's on-device
-- saved list and profile, keyed to an anonymous device UUID (no login, no PII
-- beyond first name / ZIP). Enables iOS reinstall-restore; the device UUID is a
-- bearer capability secret, so these tables are DENY-ALL to the app and are
-- reached only through the service-role `sync` edge function.

create table public.saved_backups (
  device_id uuid primary key,
  -- The SavedEntry[] blob verbatim ({ id, savedAt }[]); the client stays the
  -- source of truth for its shape, tolerantly re-parsed on restore.
  entries jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table public.profile_backups (
  device_id uuid primary key,
  -- The VeteranProfile blob verbatim; jsonb so a profile-field change needs no
  -- migration and no server-side validation duplication. Nullable so "Reset
  -- setup" can write a NULL tombstone (through the same updated_at-monotonic
  -- path as a normal push) instead of deleting the row — that way a
  -- profile-edit push still in flight at reset time can't resurrect the row.
  profile jsonb,
  updated_at timestamptz not null default now()
);

-- Deny-all: RLS on with NO anon/authenticated policies, and no grants. Only the
-- service role (inside the sync function) ever touches these rows.
alter table public.saved_backups enable row level security;
alter table public.profile_backups enable row level security;

grant select, insert, update, delete on public.saved_backups to service_role;
grant select, insert, update, delete on public.profile_backups to service_role;
