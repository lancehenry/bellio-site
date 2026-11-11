-- Bellio database setup (current version, includes upgrades 002 through 005)
-- For a brand-new Supabase project only. Paste into SQL Editor → New query → Run.
-- If you already ran the original schema, run the migration files in order instead.

-- Households: the account. Owns the forwarding address, kids, and events.
create table households (
  id uuid primary key default gen_random_uuid(),
  inbox_key text not null unique default substr(md5(random()::text), 1, 8),   -- <inbox_key>@inbox.heybellio.com
  timezone text not null default 'America/Chicago',
  subscription_status text not null default 'beta',   -- beta | active | canceled
  canceled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Members: each parent in a household, with their own phone and opt-in.
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

-- Single-use invite links for a co-parent (heybellio.com/join/<code>), expire after 7 days
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

-- Kids in a household
create table kids (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  first_name text not null,
  grade text,
  school text,
  created_at timestamptz not null default now()
);

-- Every forwarded email or texted flyer, kept so reminders can show their source
create table emails (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  source text not null default 'email',     -- email | sms_photo
  from_address text,
  subject text,
  body_text text,
  attachments jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Dates and to-dos pulled out by the AI
create table events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  email_id uuid references emails(id) on delete set null,
  kid_ids uuid[] not null default '{}',     -- empty = whole family
  event_date date not null,
  title text not null,
  action text,
  applies_to text,
  date_unclear boolean not null default false,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Every text sent or received
create table messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  direction text not null,                  -- outbound | inbound
  body text,
  twilio_sid text,
  created_at timestamptz not null default now()
);

create index events_due_idx on events (event_date) where reminder_sent_at is null;
create index members_household_idx on members (household_id);
create index invites_household_idx on invites (household_id);

alter table households enable row level security;
alter table members    enable row level security;
alter table invites    enable row level security;
alter table kids       enable row level security;
alter table emails     enable row level security;
alter table events     enable row level security;
alter table messages   enable row level security;

-- 2. Consent history: every opt-in and opt-out, kept 4 years even if the
--    person or family is deleted. This is your proof of consent if a texting
--    complaint ever comes up.
create table consent_events (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,                   -- +15555555555
  event         text not null,                   -- opt_in | opt_out
  source        text not null,                   -- web_signup | invite_link | sms_reply
  household_id  uuid references households(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index consent_events_phone_idx on consent_events (phone);

-- 3. Rate limiting: one row per attempt (signups, texts, invites). Keys are
--    hashed, so no raw IP addresses or phone numbers are stored here.
create table rate_events (
  id          bigserial primary key,
  bucket      text not null,                     -- e.g. signup_ip, welcome_phone
  key         text not null,
  created_at  timestamptz not null default now()
);
create index rate_events_lookup_idx on rate_events (bucket, key, created_at);

alter table consent_events enable row level security;
alter table rate_events    enable row level security;

-- One-time login links. Only a scrambled (hashed) copy of each link's code is
-- stored, so even someone who could read this table couldn't use the links.
create table login_tokens (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null default now() + interval '15 minutes',
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index login_tokens_member_idx on login_tokens (member_id);
alter table login_tokens enable row level security;

-- Daily cleanup, now also removing old login links.
create or replace function bellio_purge() returns jsonb
language plpgsql as $$
declare
  n int;
  result jsonb := '{}'::jsonb;
begin
  update emails set body_text = null, subject = null, from_address = null, attachments = null
   where processed_at < now() - interval '1 day'
     and (body_text is not null or subject is not null or from_address is not null);
  get diagnostics n = row_count; result := result || jsonb_build_object('email_contents_wiped', n);

  update emails set body_text = null, subject = null, from_address = null, attachments = null
   where created_at < now() - interval '7 days'
     and (body_text is not null or subject is not null or from_address is not null);
  get diagnostics n = row_count; result := result || jsonb_build_object('old_email_contents_wiped', n);

  delete from emails where created_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('emails_deleted', n);

  delete from events where event_date < current_date - 30;
  get diagnostics n = row_count; result := result || jsonb_build_object('events_deleted', n);

  delete from messages where created_at < now() - interval '90 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('messages_deleted', n);

  delete from invites where expires_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('invites_deleted', n);

  delete from households
   where subscription_status = 'canceled'
     and coalesce(canceled_at, created_at) < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('families_deleted', n);

  delete from rate_events where created_at < now() - interval '2 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('rate_events_deleted', n);

  delete from login_tokens where created_at < now() - interval '1 day';
  get diagnostics n = row_count; result := result || jsonb_build_object('login_links_deleted', n);

  delete from consent_events where created_at < now() - interval '4 years';
  get diagnostics n = row_count; result := result || jsonb_build_object('consent_events_deleted', n);

  return result;
end;
$$;

revoke execute on function bellio_purge() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function bellio_purge() from anon, authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function bellio_purge() to service_role';
  end if;
end $$;
