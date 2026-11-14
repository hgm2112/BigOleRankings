-- Upcoming release day notifications: settings, release classification, and delivery dedupe.
-- Additive only.

begin;

-- Per-user notification settings for upcoming release alerts and local-noon delivery.
alter table public.notification_settings
  add column if not exists upcoming_release_notifications boolean not null default true,
  add column if not exists timezone text;

-- Persist classification of the recent/landing release (for notification message selection).
alter table public.tv_shows
  add column if not exists recent_release_kind text,
  add column if not exists recent_release_episode_numbers jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tv_shows_recent_release_kind_check'
      and conrelid = 'public.tv_shows'::regclass
  ) then
    alter table public.tv_shows
      add constraint tv_shows_recent_release_kind_check
      check (recent_release_kind is null or recent_release_kind in ('full_season', 'episodes', 'unknown'));
  end if;
end $$;

-- Per-user (and per-device claim) delivery dedupe for upcoming release notifications.
create table if not exists public.release_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  season_number int not null,
  release_date date not null,
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, media_id, season_number, release_date, subscription_id)
);

create index if not exists release_notification_deliveries_lookup_idx
  on public.release_notification_deliveries (user_id, media_id, season_number, release_date);

alter table public.release_notification_deliveries enable row level security;
-- deliveries table intentionally has no user policies (cron/service role only)

grant all on public.release_notification_deliveries to anon, authenticated, service_role;

commit;
