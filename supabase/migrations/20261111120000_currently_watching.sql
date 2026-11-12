-- Currently Watching: per-user watch periods and append-only watch activities
-- for social feed. Supports movies and per-season TV tracking, multiple
-- historical periods, and new-period-on-resume.

create table if not exists public.watch_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  season_number int null,
  status text not null check (status in ('currently_watching', 'finished', 'dnf', 'stopped')),
  started_at date not null,
  ended_at date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watch_periods_media_season_check check (
    (media_type = 'movie' and season_number is null)
    or (media_type = 'tv' and season_number is not null and season_number >= 1)
  ),
  constraint watch_periods_status_dates_check check (
    (status = 'currently_watching' and ended_at is null)
    or (status in ('finished', 'dnf', 'stopped') and ended_at is not null)
  ),
  constraint watch_periods_date_order_check check (
    ended_at is null or ended_at >= started_at
  )
);

-- TV periods must reference an existing season row (season 0 excluded by seasons table).
-- Composite FK matches season_ratings pattern.
alter table public.watch_periods
  add constraint watch_periods_tv_season_fk
  foreign key (media_id, season_number)
  references public.seasons(media_id, season_number)
  on delete restrict;

-- Note: the FK above applies to all rows including movies (season_number null).
-- Postgres allows a FK where referencing columns are null to be satisfied (MATCH SIMPLE),
-- so movie rows are permitted without a matching seasons row. TV rows require a match.

-- At most one active watch per movie or per TV season for a user.
create unique index if not exists watch_periods_one_active_idx
  on public.watch_periods (user_id, media_id, coalesce(season_number, 0))
  where status = 'currently_watching';

create index if not exists watch_periods_user_status_updated_idx
  on public.watch_periods (user_id, status, updated_at desc);
create index if not exists watch_periods_user_media_season_started_idx
  on public.watch_periods (user_id, media_id, season_number, started_at desc, created_at desc);
create index if not exists watch_periods_user_ended_idx
  on public.watch_periods (user_id, ended_at desc);

alter table public.watch_periods enable row level security;

create policy "Watch periods are viewable by all authenticated users"
  on public.watch_periods for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own watch periods"
  on public.watch_periods for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own watch periods"
  on public.watch_periods for update
  using (auth.uid() = user_id);

create policy "Users can delete their own watch periods"
  on public.watch_periods for delete
  using (auth.uid() = user_id);

create or replace trigger on_watch_period_updated
  before update on public.watch_periods
  for each row execute function public.handle_updated_at();

grant all on public.watch_periods to authenticated, service_role;
grant select on public.watch_periods to anon;

-- Append-only social/feed events for meaningful watch actions.
-- Stable across date corrections (event identity/time independent of edited period dates).
create table if not exists public.watch_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  period_id uuid not null references public.watch_periods(id) on delete cascade,
  event_type text not null check (event_type in ('started', 'finished', 'stopped', 'dnf')),
  season_number int null,
  occurred_at timestamptz not null default now(),
  payload jsonb null
);

create index if not exists watch_activities_occurred_idx
  on public.watch_activities (occurred_at desc);
create index if not exists watch_activities_user_occurred_idx
  on public.watch_activities (user_id, occurred_at desc);
create index if not exists watch_activities_period_idx
  on public.watch_activities (period_id);

alter table public.watch_activities enable row level security;

create policy "Watch activities are viewable by all authenticated users"
  on public.watch_activities for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own watch activities"
  on public.watch_activities for insert
  with check (auth.uid() = user_id);

-- No update/delete policies: append-only by default (corrections should not
-- rewrite or duplicate meaningful feed events). Service role may manage if needed.

grant select, insert on public.watch_activities to authenticated;
grant all on public.watch_activities to service_role;
grant select on public.watch_activities to anon;
