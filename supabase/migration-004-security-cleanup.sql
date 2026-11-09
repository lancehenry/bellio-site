-- Bellio upgrade 004: consent records, rate limits, and automatic data cleanup
--
-- Run ONCE, after upgrades 002 and 003, in Supabase → SQL Editor → New query → paste → Run.
-- If anything fails, nothing changes.

begin;

-- 1. When a family was canceled, so cleanup knows when to delete it.
alter table households add column canceled_at timestamptz;
update households set canceled_at = now()
 where subscription_status = 'canceled' and canceled_at is null;

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

-- Backfill: everyone already signed up gets their original opt-in recorded.
insert into consent_events (phone, event, source, household_id, created_at)
  select phone, 'opt_in', coalesce(consent_source, 'web_signup'), household_id, coalesce(consent_at, created_at)
    from members
   where sms_consent;

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

-- 4. Automatic cleanup. The morning job calls this once a day.
--    Returns how many rows each step touched, for the logs.
create or replace function bellio_purge() returns jsonb
language plpgsql as $$
declare
  n int;
  result jsonb := '{}'::jsonb;
begin
  -- Wipe forwarded email contents a day after processing (kept briefly in case something needs a retry).
  update emails set body_text = null, subject = null, from_address = null, attachments = null
   where processed_at < now() - interval '1 day'
     and (body_text is not null or subject is not null or from_address is not null);
  get diagnostics n = row_count; result := result || jsonb_build_object('email_contents_wiped', n);

  -- Wipe any email contents after 7 days, processed or not.
  update emails set body_text = null, subject = null, from_address = null, attachments = null
   where created_at < now() - interval '7 days'
     and (body_text is not null or subject is not null or from_address is not null);
  get diagnostics n = row_count; result := result || jsonb_build_object('old_email_contents_wiped', n);

  -- Delete email records after 30 days.
  delete from emails where created_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('emails_deleted', n);

  -- Delete events 30 days after they happened.
  delete from events where event_date < current_date - 30;
  get diagnostics n = row_count; result := result || jsonb_build_object('events_deleted', n);

  -- Delete text message logs after 90 days.
  delete from messages where created_at < now() - interval '90 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('messages_deleted', n);

  -- Delete invite links 30 days after they expired.
  delete from invites where expires_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('invites_deleted', n);

  -- Delete canceled families 30 days after canceling (removes their members,
  -- kids, emails, events, invites, and messages too).
  delete from households
   where subscription_status = 'canceled'
     and coalesce(canceled_at, created_at) < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('families_deleted', n);

  -- Rate-limit records are only needed for a day or two.
  delete from rate_events where created_at < now() - interval '2 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('rate_events_deleted', n);

  -- Consent records are kept 4 years (the window for texting complaints), then removed.
  delete from consent_events where created_at < now() - interval '4 years';
  get diagnostics n = row_count; result := result || jsonb_build_object('consent_events_deleted', n);

  return result;
end;
$$;

-- Only the Bellio server (secret key) may run the cleanup.
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

commit;
