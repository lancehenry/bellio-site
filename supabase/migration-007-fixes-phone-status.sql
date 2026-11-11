-- Bellio upgrade 007: fix wrong reminders, change phone numbers, daily status report.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run twice.

-- 1. Reminders a parent removes on Manage Family are marked dismissed instead of
--    deleted, so the same item in a later newsletter isn't added back.
alter table events add column if not exists dismissed_at timestamptz;

-- 2. Codes for confirming a new phone number (only a scrambled copy of each code is kept).
create table if not exists phone_changes (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  new_phone   text not null,
  code_hash   text not null,
  attempts    int not null default 0,
  expires_at  timestamptz not null default now() + interval '10 minutes',
  created_at  timestamptz not null default now()
);
create index if not exists phone_changes_member_idx on phone_changes (member_id);
alter table phone_changes enable row level security;

-- 3. A record each time the nightly and morning jobs run, for the daily status report.
create table if not exists job_runs (
  id       bigserial primary key,
  name     text not null,                 -- nightly | morning
  ran_at   timestamptz not null default now(),
  summary  jsonb
);
create index if not exists job_runs_name_idx on job_runs (name, ran_at desc);
alter table job_runs enable row level security;

-- 4. Daily cleanup, now also removing old phone codes and job records.
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

  delete from phone_changes where created_at < now() - interval '1 day';
  get diagnostics n = row_count; result := result || jsonb_build_object('phone_codes_deleted', n);

  delete from job_runs where ran_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('job_runs_deleted', n);

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
