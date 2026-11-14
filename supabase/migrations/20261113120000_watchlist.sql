-- Watchlist: private per-user list of movies/shows to watch later.
-- Additive only. Does not modify existing rewatch or rating-history objects.

begin;

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, media_id)
);

create index if not exists watchlist_user_created_idx
  on public.watchlist (user_id, created_at desc);

alter table public.watchlist enable row level security;

create policy "Users can view their own watchlist"
  on public.watchlist for select
  using (auth.uid() = user_id);

create policy "Users can add to their own watchlist"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

create policy "Users can remove from their own watchlist"
  on public.watchlist for delete
  using (auth.uid() = user_id);

grant select, insert, delete on public.watchlist to authenticated;
grant all on public.watchlist to service_role;

-- Automatic removal: when a user starts watching or records a rating for a title,
-- remove only that user's watchlist entry for the corresponding media.
-- Covers direct client writes (e.g. season_ratings from edit/watch flows) as
-- well as API-driven operations. Scoped to (user_id, media_id) only.

create or replace function public.remove_watchlist_on_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.watchlist
   where user_id = new.user_id
     and media_id = new.media_id;
  return new;
end;
$$;

drop trigger if exists on_rating_remove_watchlist on public.ratings;
create trigger on_rating_remove_watchlist
  after insert on public.ratings
  for each row execute function public.remove_watchlist_on_engagement();

drop trigger if exists on_season_rating_remove_watchlist on public.season_ratings;
create trigger on_season_rating_remove_watchlist
  after insert on public.season_ratings
  for each row execute function public.remove_watchlist_on_engagement();

drop trigger if exists on_watch_period_remove_watchlist on public.watch_periods;
create trigger on_watch_period_remove_watchlist
  after insert on public.watch_periods
  for each row execute function public.remove_watchlist_on_engagement();

commit;
