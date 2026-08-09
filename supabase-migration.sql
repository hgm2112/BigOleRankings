-- Run this in your Supabase SQL editor to migrate an existing install
-- that has the old denormalized `entries` table to the new media/ratings model.
-- Safe to re-run (idempotent). The old `entries` table is preserved as `entries_old`.

-- 0. Safety check: only run if the old entries table exists (or already migrated)
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name in ('entries', 'entries_old')) then
    raise exception 'No entries or entries_old table found; nothing to migrate.';
  end if;
end $$;

-- 1. Create the new tables (from supabase-schema.sql)
create table if not exists media (
  id uuid default gen_random_uuid() primary key,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  year int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tmdb_id, media_type)
);

create table if not exists movies (
  id uuid references media(id) on delete cascade primary key,
  runtime int
);

create table if not exists tv_shows (
  id uuid references media(id) on delete cascade primary key,
  status text,
  next_air_date date,
  episode_runtime int,
  network text
);

create table if not exists seasons (
  id uuid default gen_random_uuid() primary key,
  media_id uuid references media(id) on delete cascade not null,
  season_number int not null check (season_number >= 1),
  name text,
  air_year int,
  episode_count int,
  unique(media_id, season_number)
);

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

-- 1b. Grant API access (mirrors supabase-schema.sql; required or the new tables
--     return 403 to anon/authenticated/service_role via PostgREST).
--     Must come after the tables exist so the grant actually applies.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- 2/3/4. Backfill media, extensions, and ratings from the old `entries` table.
--    Guarded: on a re-run after a completed migration (entries renamed to
--    entries_old), the backfills are skipped instead of erroring.
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'entries') then
    raise notice 'No entries table; skipping backfills.';
    return;
  end if;

  -- 2. Backfill media (dedupe by tmdb_id + media_type, keep the most complete row).
  --    Legacy 'misc' entries are reclassified as 'movie' (concerts/specials are real
  --    TMDB movie IDs, and the app treats misc as movie for TMDB lookups).
  insert into media (tmdb_id, media_type, title, poster_path, year, created_at, updated_at)
  select distinct on (tmdb_id, media_type)
    tmdb_id,
    media_type,
    title,
    poster_path,
    year,
    created_at,
    updated_at
  from (
    select tmdb_id,
      case when media_type = 'misc' then 'movie' else media_type end as media_type,
      title,
      poster_path,
      year,
      created_at,
      updated_at
    from entries
  ) e
  order by tmdb_id, media_type,
    (poster_path is not null) desc,
    coalesce(year, 0) desc,
    updated_at desc nulls last
  on conflict (tmdb_id, media_type) do nothing;

  -- 3. Backfill movies / tv_shows extensions
  insert into movies (id, runtime)
  select distinct on (m.id) m.id, e.runtime
  from media m
  join (
    select tmdb_id,
      case when media_type = 'misc' then 'movie' else media_type end as media_type,
      runtime,
      updated_at
    from entries
    where runtime is not null
  ) e on e.tmdb_id = m.tmdb_id and e.media_type = m.media_type
  where m.media_type = 'movie'
  order by m.id, e.updated_at desc nulls last
  on conflict (id) do nothing;

  insert into tv_shows (id, status, episode_runtime)
  select distinct on (m.id) m.id, e.status, null
  from media m
  join entries e on e.tmdb_id = m.tmdb_id and e.media_type = m.media_type
  where m.media_type = 'tv'
    and e.status is not null
  order by m.id, e.updated_at desc nulls last
  on conflict (id) do nothing;

  -- Note: seasons are NOT backfillable from the old schema (TMDB metadata).
  -- They will be populated by the refresh-status cron, which now upserts seasons.

  -- 4. Backfill ratings
  insert into ratings (user_id, media_id, notes, gut_rating, gut_rated_at,
    detailed_enjoyment, detailed_impact, detailed_recommend, detailed_watch_again,
    detailed_rated_at, weight, created_at, updated_at)
  select e.user_id, m.id, e.notes, e.gut_rating, e.gut_rated_at,
    e.detailed_enjoyment, e.detailed_impact, e.detailed_recommend, e.detailed_watch_again,
    e.detailed_rated_at, e.weight, e.created_at, e.updated_at
  from entries e
  join media m on e.tmdb_id = m.tmdb_id
    and case when e.media_type = 'misc' then 'movie' else e.media_type end = m.media_type
  on conflict (user_id, media_id) do nothing;
end $$;

-- 5. RLS (same as supabase-schema.sql)
alter table media enable row level security;
drop policy if exists "Media is viewable by all authenticated users" on media;
create policy "Media is viewable by all authenticated users"
  on media for select using (auth.role() = 'authenticated');

alter table movies enable row level security;
drop policy if exists "Movies are viewable by all authenticated users" on movies;
create policy "Movies are viewable by all authenticated users"
  on movies for select using (auth.role() = 'authenticated');

alter table tv_shows enable row level security;
drop policy if exists "TV shows are viewable by all authenticated users" on tv_shows;
create policy "TV shows are viewable by all authenticated users"
  on tv_shows for select using (auth.role() = 'authenticated');

alter table seasons enable row level security;
drop policy if exists "Seasons are viewable by all authenticated users" on seasons;
create policy "Seasons are viewable by all authenticated users"
  on seasons for select using (auth.role() = 'authenticated');

alter table ratings enable row level security;
drop policy if exists "Ratings are viewable by all authenticated users" on ratings;
create policy "Ratings are viewable by all authenticated users"
  on ratings for select using (auth.role() = 'authenticated');
drop policy if exists "Users can insert their own ratings" on ratings;
create policy "Users can insert their own ratings"
  on ratings for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own ratings" on ratings;
create policy "Users can update their own ratings"
  on ratings for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own ratings" on ratings;
create policy "Users can delete their own ratings"
  on ratings for delete using (auth.uid() = user_id);

alter table season_ratings enable row level security;
drop policy if exists "Season ratings are viewable by all authenticated users" on season_ratings;
create policy "Season ratings are viewable by all authenticated users"
  on season_ratings for select using (auth.role() = 'authenticated');
drop policy if exists "Users can insert their own season ratings" on season_ratings;
create policy "Users can insert their own season ratings"
  on season_ratings for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own season ratings" on season_ratings;
create policy "Users can update their own season ratings"
  on season_ratings for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own season ratings" on season_ratings;
create policy "Users can delete their own season ratings"
  on season_ratings for delete using (auth.uid() = user_id);

-- 6. Updated_at triggers
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

-- 7. Verify counts, then preserve the old table (renamed, not dropped).
--    Guarded so a completed migration is a no-op on re-run.
do $$
declare
  rating_count bigint;
  media_count bigint;
  old_count bigint;
begin
  select count(*) into rating_count from ratings;
  select count(*) into media_count from media;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'entries') then
    select count(*) into old_count from entries;
  elsif exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'entries_old') then
    select count(*) into old_count from entries_old;
  else
    old_count := -1;
  end if;

  if old_count >= 0 and rating_count <> old_count then
    raise notice 'WARNING: ratings count (%) does not match entries count (%). Inspect before removing entries_old.', rating_count, old_count;
  end if;
  if old_count >= 0 then
    raise notice 'Migrated % entries into % media rows.', old_count, media_count;
  else
    raise notice 'Already migrated: % ratings, % media rows. No entries table to migrate.', rating_count, media_count;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'entries')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'entries_old') then
    alter table entries rename to entries_old;
    raise notice 'Renamed entries to entries_old.';
  end if;
end $$;
