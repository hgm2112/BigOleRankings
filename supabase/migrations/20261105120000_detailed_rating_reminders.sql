-- Push subscriptions (per-device)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- One-shot scheduled reminders (gut → detailed)
create table if not exists public.scheduled_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null default 'detailed_rating',
  target_id uuid not null,           -- use ratings.media_id
  title text not null,
  scheduled_local_date date not null,
  timezone text not null,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_reminders_due_idx on public.scheduled_reminders (scheduled_local_date);

-- Per-device delivery claims (exactly-once + transient retry)
create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.scheduled_reminders (id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reminder_id, subscription_id)
);

-- Minimal per-user notification settings table.
-- Gives room for future notification options / toggles without changing the core tables.
-- For v1 we default to true and only use it lightly.
create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  detailed_rating_reminders boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists notification_settings_user_idx on public.notification_settings (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions"
  on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.scheduled_reminders enable row level security;
drop policy if exists "own scheduled reminders" on public.scheduled_reminders;
create policy "own scheduled reminders"
  on public.scheduled_reminders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.reminder_deliveries enable row level security;
-- deliveries table intentionally has no policies (cron-only via service role)

alter table public.notification_settings enable row level security;
drop policy if exists "own notification settings" on public.notification_settings;
create policy "own notification settings"
  on public.notification_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants are required for the roles used by the app (anon for public reads where allowed,
-- authenticated for user operations, service_role for crons/admin).
-- These were present in the original project schema but were omitted from this migration,
-- which is why even the service role and authenticated clients were getting
-- "permission denied for table push_subscriptions".
grant usage on schema public to anon, authenticated, service_role;
grant all on public.push_subscriptions to anon, authenticated, service_role;
grant all on public.scheduled_reminders to anon, authenticated, service_role;
grant all on public.reminder_deliveries to anon, authenticated, service_role;
grant all on public.notification_settings to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
