-- Bellio upgrade 005: one-time login links for the Manage Family page
--
-- Run ONCE, after upgrade 004, in Supabase → SQL Editor → New query → paste → Run.
-- If anything fails, nothing changes.

begin;

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

commit;
