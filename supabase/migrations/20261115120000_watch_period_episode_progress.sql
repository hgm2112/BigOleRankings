-- Optional per-period episode progress for TV watching (personal tracking only; not shown in social feed).
alter table public.watch_periods
  add column if not exists current_episode int;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'watch_periods_current_episode_check'
      and conrelid = 'public.watch_periods'::regclass
  ) then
    alter table public.watch_periods
      add constraint watch_periods_current_episode_check
      check (current_episode is null or current_episode >= 1);
  end if;
end $$;
