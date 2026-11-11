-- Bellio upgrade 006: remember when a family got its "first school email" text,
-- so it's only ever sent once. Run once in Supabase → SQL Editor → New query → Run.

alter table households add column if not exists first_email_texted_at timestamptz;

-- Families that already have emails don't need a "first email" text.
update households set first_email_texted_at = now()
 where first_email_texted_at is null
   and exists (select 1 from emails where emails.household_id = households.id);
