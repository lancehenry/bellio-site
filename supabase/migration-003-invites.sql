-- Bellio upgrade 003: single-use invite links that expire
--
-- Run ONCE, after upgrade 002, in Supabase → SQL Editor → New query → paste → Run.
-- Each invite link now works one time and expires after 7 days.
-- If anything fails, nothing changes.

begin;

create table invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  created_by uuid references members(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);

create index invites_household_idx on invites (household_id);
alter table invites enable row level security;

-- The old reusable invite code is no longer used.
alter table households drop column invite_code;

commit;
