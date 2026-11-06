-- Run this ONCE in the Supabase SQL Editor (https://supabase.com/dashboard/project/dbpoechkclfleutplmmj/sql)
-- for the project using the keys stored in .env.local
-- This grants the missing table privileges that cause "permission denied for table push_subscriptions"
-- even for the service_role key.
-- Safe to re-run. After this, the browser client upsert from "Enable on this device" will work
-- (RLS will then limit to the user's own rows via the policy).

grant usage on schema public to anon, authenticated, service_role;

grant all on public.push_subscriptions to anon, authenticated, service_role;
grant all on public.scheduled_reminders to anon, authenticated, service_role;
grant all on public.reminder_deliveries to anon, authenticated, service_role;
grant all on public.notification_settings to anon, authenticated, service_role;

grant all on all sequences in schema public to anon, authenticated, service_role;

-- Verify after running:
--   select * from pg_policies where tablename = 'push_subscriptions';
--   select grantee, privilege_type from information_schema.table_privileges where table_name='push_subscriptions' limit 5;
