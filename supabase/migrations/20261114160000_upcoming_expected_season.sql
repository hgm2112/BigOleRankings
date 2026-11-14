-- Expected next season for renewed shows awaiting a release date.
-- Additive only.

begin;

alter table public.tv_shows
  add column if not exists expected_season_number int;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tv_shows_expected_season_number_check'
      and conrelid = 'public.tv_shows'::regclass
  ) then
    alter table public.tv_shows
      add constraint tv_shows_expected_season_number_check
      check (expected_season_number is null or expected_season_number >= 1);
  end if;
end $$;

commit;
