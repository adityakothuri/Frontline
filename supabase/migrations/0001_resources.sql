-- Frontline Phase 10 — the resources table.
-- Mirrors src/types/resource.ts column-for-column: the client Resource type is
-- the contract, so column names/nullability must never drift from it.
-- text + check constraints (not PG enums) so adding a category is one migration
-- line, not an enum surgery.

create table public.resources (
  id text primary key,
  name text not null,
  category text not null check (category in (
    'food', 'clothing', 'housing', 'healthcare', 'benefits_help', 'legal',
    'jobs', 'education', 'transportation', 'emergency', 'community_support'
  )),
  description text not null,
  address text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  hours text,
  eligibility text,
  documents_needed text[] not null default '{}',
  source_url text,
  source_type text not null check (source_type in (
    'official', 'directory', 'nonprofit', 'community', 'unverified'
  )),
  verification_status text not null check (verification_status in (
    'verified', 'needs_review', 'unverified'
  )),
  -- Dates stay `date` (PostgREST serializes as 'YYYY-MM-DD', exactly what the
  -- client type expects). last_checked is a human judgment recorded by the
  -- curator — never auto-stamped by the database or the seed script.
  last_checked date not null,
  last_updated date not null,
  tags text[] not null default '{}',
  created_at date not null,
  updated_at date not null,
  -- A located resource has both coordinates or neither (phone/online-only).
  constraint coords_complete check ((latitude is null) = (longitude is null))
);

create index resources_category_idx on public.resources (category);

-- Read-only for the app. RLS on + select-only policy; explicit revokes are the
-- belt-and-suspenders that survive a future accidentally-permissive policy.
alter table public.resources enable row level security;

create policy "anon can read resources"
  on public.resources for select
  to anon, authenticated
  using (true);

grant select on public.resources to anon, authenticated;
revoke insert, update, delete on public.resources from anon, authenticated;
