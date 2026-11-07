-- Bellio database setup
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.

-- Parents who sign up
create table parents (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  email text not null,
  phone text not null unique,               -- +15555555555 format
  inbox_key text not null unique            -- their forwarding address: <inbox_key>@inbox.heybellio.com
    default substr(md5(random()::text), 1, 8),
  timezone text not null default 'America/Chicago',
  sms_consent boolean not null default false,
  consent_at timestamptz,
  consent_source text,
  sms_opted_out boolean not null default false,  -- set true when they text STOP
  subscription_status text not null default 'beta', -- beta | active | canceled
  created_at timestamptz not null default now()
);

-- Kids linked to a parent (optional, helps label reminders)
create table kids (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  first_name text not null,
  grade text,
  school text,
  created_at timestamptz not null default now()
);

-- Every forwarded email or texted flyer, kept so reminders can show their source
create table emails (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  source text not null default 'email',     -- email | sms_photo
  from_address text,
  subject text,
  body_text text,
  attachments jsonb,                        -- file names / storage paths
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Dates and to-dos pulled out by the AI
create table events (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  kid_id uuid references kids(id) on delete set null,
  email_id uuid references emails(id) on delete set null,
  event_date date not null,
  title text not null,                      -- "Picture day"
  action text,                              -- "Wear a collared shirt"
  applies_to text,                          -- "Whole school", "3rd grade", etc.
  date_unclear boolean not null default false,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Every text sent or received
create table messages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete cascade,
  direction text not null,                  -- outbound | inbound
  body text,
  twilio_sid text,
  created_at timestamptz not null default now()
);

-- Speeds up the nightly "what's tomorrow?" lookup
create index events_due_idx on events (event_date) where reminder_sent_at is null;

-- Lock every table down. Only the Bellio server (using the secret key) can read or write.
alter table parents  enable row level security;
alter table kids     enable row level security;
alter table emails   enable row level security;
alter table events   enable row level security;
alter table messages enable row level security;
