-- Upcoming Releases: store per-show upcoming season/premiere info and last successful check.
-- Additive only. TV show release metadata is shared (tv_shows/seasons).

begin;

alter table public.tv_shows
  add column if not exists upcoming_season_number int,
  add column if not exists upcoming_release_date date,
  add column if not exists release_info_last_checked_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tv_shows_upcoming_season_number_check'
      and conrelid = 'public.tv_shows'::regclass
  ) then
    alter table public.tv_shows
      add constraint tv_shows_upcoming_season_number_check
      check (upcoming_season_number is null or upcoming_season_number >= 1);
  end if;
end $$;

alter table public.seasons
  add column if not exists air_date date;

commit;
