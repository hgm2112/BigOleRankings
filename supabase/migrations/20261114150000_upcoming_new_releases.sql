-- New Releases: persist recently landed season premiere for 30-day "New Releases" section.
-- Additive only.

begin;

alter table public.tv_shows
  add column if not exists recent_release_season_number int,
  add column if not exists recent_release_date date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tv_shows_recent_release_season_number_check'
      and conrelid = 'public.tv_shows'::regclass
  ) then
    alter table public.tv_shows
      add constraint tv_shows_recent_release_season_number_check
      check (recent_release_season_number is null or recent_release_season_number >= 1);
  end if;
end $$;

commit;
