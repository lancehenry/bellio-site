-- Bellio upgrade 002: households, co-parents, and kids on events
--
-- Run ONCE in Supabase → SQL Editor → New query → paste this whole file → Run.
-- It keeps all your existing data: each current parent becomes a household
-- with that parent as its first member. If anything fails, nothing changes.

begin;

-- 1. Households: the account. Owns the forwarding address, kids, and events.
create table households (
  id uuid primary key default gen_random_uuid(),
  inbox_key text not null unique default substr(md5(random()::text), 1, 8),
  invite_code text not null unique default substr(md5(random()::text), 1, 10),
  timezone text not null default 'America/Chicago',
  subscription_status text not null default 'beta',   -- beta | active | canceled
  created_at timestamptz not null default now()
);

-- 2. Members: each parent in a household, with their own phone and opt-in.
create table members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  first_name text not null,
  email text,
  phone text not null unique,                        -- +15555555555 format
  role text not null default 'owner',                -- owner | co-parent
  sms_consent boolean not null default false,
  consent_at timestamptz,
  consent_source text,
  sms_opted_out boolean not null default false,      -- set true when they text STOP
  created_at timestamptz not null default now()
);

-- 3. Move existing parents over (same IDs, so links stay intact).
insert into households (id, inbox_key, timezone, subscription_status, created_at)
  select id, inbox_key, timezone, subscription_status, created_at from parents;

insert into members (household_id, first_name, email, phone, role,
                     sms_consent, consent_at, consent_source, sms_opted_out, created_at)
  select id, first_name, email, phone, 'owner',
         sms_consent, consent_at, consent_source, sms_opted_out, created_at
  from parents;

-- 4. Point kids, emails, events, and messages at households instead of parents.
alter table kids     rename column parent_id to household_id;
alter table emails   rename column parent_id to household_id;
alter table events   rename column parent_id to household_id;
alter table messages rename column parent_id to household_id;

alter table kids     drop constraint if exists kids_parent_id_fkey;
alter table emails   drop constraint if exists emails_parent_id_fkey;
alter table events   drop constraint if exists events_parent_id_fkey;
alter table messages drop constraint if exists messages_parent_id_fkey;

alter table kids     add constraint kids_household_id_fkey     foreign key (household_id) references households(id) on delete cascade;
alter table emails   add constraint emails_household_id_fkey   foreign key (household_id) references households(id) on delete cascade;
alter table events   add constraint events_household_id_fkey   foreign key (household_id) references households(id) on delete cascade;
alter table messages add constraint messages_household_id_fkey foreign key (household_id) references households(id) on delete cascade;

-- 5. Which member sent or received each text.
alter table messages add column member_id uuid references members(id) on delete set null;

-- 6. Events can apply to one or more kids. Empty list = the whole family.
alter table events drop column if exists kid_id;
alter table events add column kid_ids uuid[] not null default '{}';

-- 7. The old parents table is no longer needed.
drop table parents;

-- 8. Lock the new tables down like the others.
alter table households enable row level security;
alter table members    enable row level security;

create index members_household_idx on members (household_id);

commit;
