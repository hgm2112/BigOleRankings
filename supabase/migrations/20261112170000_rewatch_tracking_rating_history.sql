-- Rewatch tracking, full-series recognition, and rating history (additive)
-- Assumes existing objects from supabase-schema.sql / prior migrations:
--   media, seasons, ratings, season_ratings, watch_periods, watch_activities,
--   profiles, auth.users, public.handle_updated_at()

begin;

-- ---------------------------------------------------------------------------
-- 1) Rating history: append-only log of actual rating changes.
--    ratings / season_ratings remain the current source of truth.
-- ---------------------------------------------------------------------------

create table if not exists public.rating_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,

  -- null = overall movie/show rating; set (>=1) = per-TV-season rating
  season_number int null check (season_number is null or season_number >= 1),

  -- Scope/kind disambiguate overall gut vs detailed vs season ratings.
  --   movie_overall + gut|detailed  (season_number null)
  --   tv_overall    + gut|detailed  (season_number null)
  --   tv_season     + season         (season_number not null)
  rating_scope text not null check (rating_scope in ('movie_overall', 'tv_overall', 'tv_season')),
  rating_kind  text not null check (rating_kind  in ('gut', 'detailed', 'season')),

  -- Gut overall (1-100)
  prev_gut int null check (prev_gut between 1 and 100),
  new_gut  int null check (new_gut  between 1 and 100),

  -- Detailed overall components (match ratings schema)
  prev_detailed_enjoyment  int null check (prev_detailed_enjoyment  between 0 and 60),
  prev_detailed_impact     int null check (prev_detailed_impact     between 0 and 20),
  prev_detailed_recommend  int null check (prev_detailed_recommend  between 0 and 10),
  prev_detailed_watch_again int null check (prev_detailed_watch_again  between 0 and 10),
  new_detailed_enjoyment   int null check (new_detailed_enjoyment   between 0 and 60),
  new_detailed_impact      int null check (new_detailed_impact      between 0 and 20),
  new_detailed_recommend   int null check (new_detailed_recommend   between 0 and 10),
  new_detailed_watch_again int null check (new_detailed_watch_again  between 0 and 10),

  -- Per-season rating state (match season_ratings: rating 1-10 or null, dnf flag)
  prev_season_rating int null check (prev_season_rating between 1 and 10),
  prev_season_dnf    boolean null,
  new_season_rating  int null check (new_season_rating between 1 and 10),
  new_season_dnf     boolean null,

  changed_at timestamptz not null default now(),

  -- Associated completed viewing/period when the change was prompted by one (nullable).
  watch_period_id uuid null references public.watch_periods(id) on delete set null,

  -- Optional context for idempotency/debugging (e.g. entry_edit, detailed_page, watch_finish)
  source text null,

  constraint rating_history_scope_season_check check (
    (rating_scope = 'tv_season' and season_number is not null and rating_kind = 'season')
    or (rating_scope in ('movie_overall', 'tv_overall') and season_number is null and rating_kind in ('gut', 'detailed'))
  ),
  constraint rating_history_gut_shape_check check (
    rating_kind <> 'gut' or (
      prev_gut is not null and new_gut is not null
      and prev_detailed_enjoyment is null and new_detailed_enjoyment is null
      and prev_season_rating is null and new_season_rating is null
      and prev_season_dnf is null and new_season_dnf is null
    )
  ),
  constraint rating_history_detailed_shape_check check (
    rating_kind <> 'detailed' or (
      prev_detailed_enjoyment is not null and prev_detailed_impact is not null
      and prev_detailed_recommend is not null and prev_detailed_watch_again is not null
      and new_detailed_enjoyment is not null and new_detailed_impact is not null
      and new_detailed_recommend is not null and new_detailed_watch_again is not null
      and prev_gut is null and new_gut is null
      and prev_season_rating is null and new_season_rating is null
      and prev_season_dnf is null and new_season_dnf is null
    )
  ),
  constraint rating_history_season_shape_check check (
    rating_kind <> 'season' or (
      prev_season_dnf is not null and new_season_dnf is not null
      and prev_gut is null and new_gut is null
      and prev_detailed_enjoyment is null and new_detailed_enjoyment is null
    )
  )
);

create index if not exists rating_history_user_media_season_changed_idx
  on public.rating_history (user_id, media_id, coalesce(season_number, 0), changed_at desc);
create index if not exists rating_history_user_changed_idx
  on public.rating_history (user_id, changed_at desc);
create index if not exists rating_history_watch_period_idx
  on public.rating_history (watch_period_id);

-- Idempotency for period-associated submissions (reprocessed finish prompts)
create unique index if not exists rating_history_period_scope_kind_uidx
  on public.rating_history (watch_period_id, rating_scope, rating_kind, coalesce(season_number, 0))
  where watch_period_id is not null;

alter table public.rating_history enable row level security;

create policy "Users can view their own rating history"
  on public.rating_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own rating history"
  on public.rating_history for insert
  with check (auth.uid() = user_id);

-- append-only for end users

grant select, insert on public.rating_history to authenticated;
grant all on public.rating_history to service_role;

-- ---------------------------------------------------------------------------
-- 2) Full-series rewatch grouping (TV)
-- ---------------------------------------------------------------------------

create table if not exists public.tv_full_series_rewatches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  rewatch_number int not null check (rewatch_number >= 1),
  recognized_at timestamptz not null default now(),
  -- Snapshot of released regular seasons (season_number >= 1) at recognition time.
  season_numbers_snapshot int[] not null,
  season_count_snapshot int not null check (season_count_snapshot >= 1),
  constraint tv_full_series_rewatches_snapshot_len_check
    check (cardinality(season_numbers_snapshot) = season_count_snapshot),
  constraint tv_full_series_rewatches_user_media_number_uniq
    unique (user_id, media_id, rewatch_number)
);

create index if not exists tv_full_series_rewatches_user_media_idx
  on public.tv_full_series_rewatches (user_id, media_id);
create index if not exists tv_full_series_rewatches_user_recognized_idx
  on public.tv_full_series_rewatches (user_id, recognized_at desc);

alter table public.tv_full_series_rewatches enable row level security;

create policy "Users can view their own full-series rewatches"
  on public.tv_full_series_rewatches for select
  using (auth.uid() = user_id);

create policy "Users can insert their own full-series rewatches"
  on public.tv_full_series_rewatches for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own full-series rewatches"
  on public.tv_full_series_rewatches for delete
  using (auth.uid() = user_id);

grant select, insert, delete on public.tv_full_series_rewatches to authenticated;
grant all on public.tv_full_series_rewatches to service_role;

-- Membership: a completed TV season watch_period may belong to at most one group.
alter table public.watch_periods
  add column if not exists full_series_rewatch_id uuid
    references public.tv_full_series_rewatches(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'watch_periods_full_series_tv_check'
      and conrelid = 'public.watch_periods'::regclass
  ) then
    alter table public.watch_periods
      add constraint watch_periods_full_series_tv_check
      check (
        full_series_rewatch_id is null
        or (media_type = 'tv' and season_number is not null and season_number >= 1)
      );
  end if;
end $$;

create index if not exists watch_periods_full_series_rewatch_idx
  on public.watch_periods (full_series_rewatch_id)
  where full_series_rewatch_id is not null;

create index if not exists watch_periods_user_media_season_finished_idx
  on public.watch_periods (user_id, media_id, season_number, ended_at asc, started_at asc, created_at asc, id asc)
  where status = 'finished' and ended_at is not null and media_type = 'tv' and season_number is not null;

-- ---------------------------------------------------------------------------
-- 3) Aggregation & reconciliation helpers (idempotent, transactional)
-- ---------------------------------------------------------------------------

create or replace function public._dissolve_tv_full_series_rewatch(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_group_id is null then
    return;
  end if;

  update public.watch_periods
     set full_series_rewatch_id = null
   where full_series_rewatch_id = p_group_id;

  delete from public.tv_full_series_rewatches
   where id = p_group_id;
end;
$$;

create or replace function public._watch_period_invalidate_full_series_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_still_valid boolean;
begin
  if tg_op = 'DELETE' then
    v_group_id := old.full_series_rewatch_id;
    if v_group_id is not null then
      perform public._dissolve_tv_full_series_rewatch(v_group_id);
    end if;
    return old;
  end if;

  v_group_id := old.full_series_rewatch_id;
  if v_group_id is null then
    return new;
  end if;

  v_still_valid :=
    new.full_series_rewatch_id = v_group_id
    and new.status = 'finished'
    and new.ended_at is not null
    and new.media_type = 'tv'
    and new.season_number is not null
    and new.season_number >= 1
    and new.user_id = old.user_id
    and new.media_id = old.media_id
    and new.season_number = old.season_number;

  if not v_still_valid then
    perform public._dissolve_tv_full_series_rewatch(v_group_id);
    if new.full_series_rewatch_id = v_group_id then
      new.full_series_rewatch_id := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_watch_period_invalidate_full_series_group on public.watch_periods;
create trigger on_watch_period_invalidate_full_series_group
  after delete or update on public.watch_periods
  for each row execute function public._watch_period_invalidate_full_series_group();

-- Recognize (and persist) full-series rewatches as currently eligible for
-- (user_id, media_id). Safe to call repeatedly (idempotent).
create or replace function public.recognize_tv_full_series_rewatches(
  p_user_id uuid,
  p_media_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key bigint;
  v_seasons int[];
  v_season_count int;
  v_next_number int;
  v_created int := 0;
  v_group_id uuid;
  rec record;
begin
  -- Serialize recognition per (user, media)
  v_lock_key := hashtextextended(p_user_id::text || ':' || p_media_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  -- Known released regular seasons (snapshot). Excludes season 0.
  select array_agg(s.season_number order by s.season_number)
    into v_seasons
  from public.seasons s
  where s.media_id = p_media_id
    and s.season_number >= 1;

  if v_seasons is null or cardinality(v_seasons) = 0 then
    return 0; -- metadata unavailable/incomplete: do not assume completeness
  end if;

  v_season_count := cardinality(v_seasons);

  select coalesce(max(r.rewatch_number), 0) + 1
    into v_next_number
  from public.tv_full_series_rewatches r
  where r.user_id = p_user_id and r.media_id = p_media_id;

  loop
    -- For every required season, pick earliest eligible ungrouped additional
    -- completed viewing (rn > 1 excludes the original). Require one per season.
    with finished as (
      select
        wp.id,
        wp.season_number,
        wp.ended_at,
        wp.started_at,
        wp.created_at,
        row_number() over (
          partition by wp.season_number
          order by wp.ended_at asc, wp.started_at asc, wp.created_at asc, wp.id asc
        ) as rn
      from public.watch_periods wp
      where wp.user_id = p_user_id
        and wp.media_id = p_media_id
        and wp.media_type = 'tv'
        and wp.season_number = any(v_seasons)
        and wp.status = 'finished'
        and wp.ended_at is not null
    ),
    eligible as (
      select f.*
      from finished f
      where f.rn > 1
        and not exists (
          select 1 from public.watch_periods g
          where g.id = f.id and g.full_series_rewatch_id is not null
        )
    ),
    pick_per_season as (
      select distinct on (e.season_number)
        e.id, e.season_number
      from eligible e
      order by e.season_number, e.ended_at asc, e.started_at asc, e.created_at asc, e.id asc
    )
    select count(*)::int as count, array_agg(id) as ids
      into rec
    from pick_per_season;

    if rec.count is distinct from v_season_count then
      exit; -- not every required season has an eligible additional viewing yet
    end if;

    insert into public.tv_full_series_rewatches (
      user_id, media_id, rewatch_number, season_numbers_snapshot, season_count_snapshot
    ) values (
      p_user_id, p_media_id, v_next_number, v_seasons, v_season_count
    )
    returning id into v_group_id;

    update public.watch_periods wp
       set full_series_rewatch_id = v_group_id
     where wp.id = any(rec.ids)
       and wp.full_series_rewatch_id is null
       and wp.status = 'finished'
       and wp.ended_at is not null;

    if not found then
      delete from public.tv_full_series_rewatches where id = v_group_id;
      exit;
    end if;

    v_created := v_created + 1;
    v_next_number := v_next_number + 1;
  end loop;

  return v_created;
end;
$$;

-- Dissolve groups no longer fully valid, then re-recognize. Idempotent.
create or replace function public.reconcile_tv_full_series_rewatches(
  p_user_id uuid,
  p_media_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key bigint;
  g record;
  v_valid_count int;
begin
  v_lock_key := hashtextextended(p_user_id::text || ':' || p_media_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  for g in
    select id, season_numbers_snapshot, season_count_snapshot
    from public.tv_full_series_rewatches
    where user_id = p_user_id and media_id = p_media_id
    order by rewatch_number
  loop
    select count(distinct wp.season_number)::int
      into v_valid_count
    from public.watch_periods wp
    where wp.full_series_rewatch_id = g.id
      and wp.user_id = p_user_id
      and wp.media_id = p_media_id
      and wp.media_type = 'tv'
      and wp.status = 'finished'
      and wp.ended_at is not null
      and wp.season_number = any(g.season_numbers_snapshot);

    if v_valid_count is distinct from g.season_count_snapshot then
      perform public._dissolve_tv_full_series_rewatch(g.id);
    end if;
  end loop;

  return public.recognize_tv_full_series_rewatches(p_user_id, p_media_id);
end;
$$;

grant execute on function public.recognize_tv_full_series_rewatches(uuid, uuid) to authenticated, service_role;
grant execute on function public.reconcile_tv_full_series_rewatches(uuid, uuid) to authenticated, service_role;

commit;
