-- Run this in your Supabase SQL editor (fresh install).
-- For an existing install with an `entries` table, use supabase-migration.sql instead.

-- Grant API access
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- 1. Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  theme text not null default 'default',
  customization jsonb not null default '{"score_chips": true, "media_badges": true, "stat_chips": true, "poster_themes": false, "background": "purple"}'::jsonb,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup; also pin + follow "rise" as the default
-- friend (only while the new user has no pinned friend, and only if rise
-- exists on this install).
create or replace function public.handle_new_user()
returns trigger as $$
declare
  rise_id uuid;
  new_profile_id uuid;
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'username'
  )
  returning id into new_profile_id;

  select id into rise_id from public.profiles where username = 'rise' limit 1;

  if rise_id is not null and rise_id <> new_profile_id then
    update public.profiles
    set pinned_user_id = rise_id
    where id = new_profile_id
      and pinned_user_id is null
      and pinned_user_id_2 is null
      and pinned_user_id_3 is null;

    insert into public.follows (follower_id, following_id)
    values (new_profile_id, rise_id)
    on conflict (follower_id, following_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Media tables: shared metadata, deduplicated by tmdb_id + media_type.
--    Media rows are readable by all authenticated users and written by the
--    service role only (API routes / cron). Movies and TV get separate
--    extension tables so TV can carry its own columns (status, air dates...).

create table if not exists media (
  id uuid default gen_random_uuid() primary key,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  year int,
  genres text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tmdb_id, media_type)
);

alter table media enable row level security;

create policy "Media is viewable by all authenticated users"
  on media for select
  using (auth.role() = 'authenticated');

create table if not exists movies (
  id uuid references media(id) on delete cascade primary key,
  runtime int
);

alter table movies enable row level security;

create policy "Movies are viewable by all authenticated users"
  on movies for select
  using (auth.role() = 'authenticated');

create table if not exists tv_shows (
  id uuid references media(id) on delete cascade primary key,
  status text,
  next_air_date date,
  network text,
  upcoming_season_number int check (upcoming_season_number is null or upcoming_season_number >= 1),
  upcoming_release_date date,
  release_info_last_checked_at timestamptz,
  recent_release_season_number int check (recent_release_season_number is null or recent_release_season_number >= 1),
  recent_release_date date
);

alter table tv_shows enable row level security;

create policy "TV shows are viewable by all authenticated users"
  on tv_shows for select
  using (auth.role() = 'authenticated');

-- Seasons come from TMDB and are refreshed by the cron. Specials (season 0)
-- are never stored.
create table if not exists seasons (
  id uuid default gen_random_uuid() primary key,
  media_id uuid references media(id) on delete cascade not null,
  season_number int not null check (season_number >= 1),
  name text,
  air_year int,
  air_date date,
  episode_count int,
  episode_runtime int,
  unique(media_id, season_number)
);

alter table seasons enable row level security;

create policy "Seasons are viewable by all authenticated users"
  on seasons for select
  using (auth.role() = 'authenticated');

-- 3. Ratings: one row per (user, media). Everything user-specific lives here.
create table if not exists ratings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  media_id uuid references media(id) on delete cascade not null,
  notes text default '',
  gut_rating int check (gut_rating >= 1 and gut_rating <= 100),
  gut_rated_at timestamptz,
  detailed_enjoyment int check (detailed_enjoyment >= 0 and detailed_enjoyment <= 60),
  detailed_impact int check (detailed_impact >= 0 and detailed_impact <= 20),
  detailed_recommend int check (detailed_recommend >= 0 and detailed_recommend <= 10),
  detailed_watch_again int check (detailed_watch_again >= 0 and detailed_watch_again <= 10),
  detailed_rated_at timestamptz,
  weight int not null default 0 check (weight >= 0 and weight <= 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, media_id)
);

alter table ratings enable row level security;

create policy "Ratings are viewable by all authenticated users"
  on ratings for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own ratings"
  on ratings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own ratings"
  on ratings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own ratings"
  on ratings for delete
  using (auth.uid() = user_id);

-- 4. Season ratings: per-user 1-10 rating + DNF flag for a season.
--    The composite FK to seasons(media_id, season_number) guarantees a rating
--    can only exist for a season that actually exists.
create table if not exists season_ratings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  media_id uuid not null,
  season_number int not null check (season_number >= 1),
  rating int check (rating >= 1 and rating <= 10),
  dnf boolean not null default false,
  updated_at timestamptz default now(),
  unique(user_id, media_id, season_number),
  foreign key (media_id, season_number)
    references seasons(media_id, season_number)
    on delete restrict
);

alter table season_ratings enable row level security;

create policy "Season ratings are viewable by all authenticated users"
  on season_ratings for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own season ratings"
  on season_ratings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own season ratings"
  on season_ratings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own season ratings"
  on season_ratings for delete
  using (auth.uid() = user_id);

-- 5. Follows table
create table if not exists follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(follower_id, following_id)
);

alter table follows enable row level security;

create policy "Users can view their own follows"
  on follows for select
  using (auth.uid() = follower_id or auth.uid() = following_id);

create policy "Users can follow others"
  on follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on follows for delete
  using (auth.uid() = follower_id);

grant all on follows to authenticated, anon;

-- 6. Feed likes: a "like" on one derived /social feed event.
--    event_key matches the app-generated key:
--      'gut:{ratingId}' | 'detailed:{ratingId}' | 'season:{userId}:{mediaId}:{seasonNumber}'
--    user_id references profiles (like follows) so liker names can be embedded
--    in a single query. Orphaned likes (event's rating deleted) never render.
create table if not exists feed_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  event_key text not null,
  created_at timestamptz default now(),
  unique(user_id, event_key)
);

alter table feed_likes enable row level security;

create policy "Likes are viewable by all authenticated users"
  on feed_likes for select
  using (auth.role() = 'authenticated');

create policy "Users can like updates"
  on feed_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike updates"
  on feed_likes for delete
  using (auth.uid() = user_id);

create index if not exists feed_likes_event_key_idx on feed_likes (event_key);

grant all on feed_likes to authenticated;

-- Add pinned_user_id to profiles
alter table profiles add column if not exists pinned_user_id uuid references profiles(id) on delete set null;

-- Add 2 more pinned slots (was single pinned_user_id)
alter table profiles add column if not exists pinned_user_id_2 uuid references profiles(id) on delete set null;
alter table profiles add column if not exists pinned_user_id_3 uuid references profiles(id) on delete set null;

-- UI accent toggles (score chips, media badges, stat chips) and background color
alter table profiles add column if not exists customization jsonb
  not null default '{"score_chips": true, "media_badges": true, "stat_chips": true, "poster_themes": false, "background": "purple"}'::jsonb;

-- Updated_at triggers
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger on_media_updated
  before update on media
  for each row execute function public.handle_updated_at();

create or replace trigger on_rating_updated
  before update on ratings
  for each row execute function public.handle_updated_at();

create or replace trigger on_season_rating_updated
  before update on season_ratings
  for each row execute function public.handle_updated_at();

-- Orphan cleanup: when a rating (or season rating) is deleted, drop the media
-- row (and its movies/tv_shows/seasons via cascade) if no user references it
-- anymore. Security definer so the delete works from user sessions (RLS).
create or replace function public.cleanup_orphaned_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from media m
  where m.id = old.media_id
    and not exists (select 1 from ratings r where r.media_id = m.id)
    and not exists (select 1 from season_ratings sr where sr.media_id = m.id);
  return old;
end;
$$;

create or replace trigger on_rating_delete_cleanup
  after delete on ratings
  for each row execute function public.cleanup_orphaned_media();

create or replace trigger on_season_rating_delete_cleanup
  after delete on season_ratings
  for each row execute function public.cleanup_orphaned_media();

-- Feed indexes for the /social activity feed (safe to re-run on an existing
-- install from the Supabase SQL editor).
create index if not exists ratings_user_gut_rated_at_idx on ratings (user_id, gut_rated_at);
create index if not exists ratings_user_detailed_rated_at_idx on ratings (user_id, detailed_rated_at);
create index if not exists season_ratings_user_updated_at_idx on season_ratings (user_id, updated_at);
create index if not exists follows_follower_idx on follows (follower_id);

-- 7. Currently Watching: watch periods (history) and activities (social feed)
--    New-period-on-resume: resuming a stopped movie/season creates a new
--    currently_watching period so previous dates/outcomes remain intact.
--    Feed events are append-only (watch_activities) so date corrections on
--    periods do not duplicate or rewrite meaningful activity.

create table if not exists watch_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
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
  ),
  -- MATCH SIMPLE: movie rows (season_number null) are not required to match a
  -- seasons row; TV rows must reference an existing season.
  constraint watch_periods_tv_season_fk
    foreign key (media_id, season_number)
    references seasons(media_id, season_number)
    on delete restrict
);

create unique index if not exists watch_periods_one_active_idx
  on watch_periods (user_id, media_id, coalesce(season_number, 0))
  where status = 'currently_watching';

create index if not exists watch_periods_user_status_updated_idx
  on watch_periods (user_id, status, updated_at desc);
create index if not exists watch_periods_user_media_season_started_idx
  on watch_periods (user_id, media_id, season_number, started_at desc, created_at desc);
create index if not exists watch_periods_user_ended_idx
  on watch_periods (user_id, ended_at desc);

alter table watch_periods enable row level security;

create policy "Watch periods are viewable by all authenticated users"
  on watch_periods for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own watch periods"
  on watch_periods for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own watch periods"
  on watch_periods for update
  using (auth.uid() = user_id);

create policy "Users can delete their own watch periods"
  on watch_periods for delete
  using (auth.uid() = user_id);

create or replace trigger on_watch_period_updated
  before update on watch_periods
  for each row execute function public.handle_updated_at();

grant all on watch_periods to authenticated, service_role;
grant select on watch_periods to anon;

create table if not exists watch_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  period_id uuid not null references watch_periods(id) on delete cascade,
  event_type text not null check (event_type in ('started', 'finished', 'stopped', 'dnf')),
  season_number int null,
  occurred_at timestamptz not null default now(),
  payload jsonb null
);

create index if not exists watch_activities_occurred_idx
  on watch_activities (occurred_at desc);
create index if not exists watch_activities_user_occurred_idx
  on watch_activities (user_id, occurred_at desc);
create index if not exists watch_activities_period_idx
  on watch_activities (period_id);

alter table watch_activities enable row level security;

create policy "Watch activities are viewable by all authenticated users"
  on watch_activities for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own watch activities"
  on watch_activities for insert
  with check (auth.uid() = user_id);

grant select, insert on watch_activities to authenticated;
grant all on watch_activities to service_role;
grant select on watch_activities to anon;
