-- Bellio database setup (current version, includes upgrades 002 and 003)
-- For a brand-new Supabase project only. Paste into SQL Editor → New query → Run.
-- If you already ran the original schema, run the migration files in order instead.

-- Households: the account. Owns the forwarding address, kids, and events.
create table households (
  id uuid primary key default gen_random_uuid(),
  inbox_key text not null unique default substr(md5(random()::text), 1, 8),   -- <inbox_key>@inbox.heybellio.com
  timezone text not null default 'America/Chicago',
  subscription_status text not null default 'beta',   -- beta | active | canceled
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
