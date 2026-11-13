-- Baseline backfill (Option 2): establish original completed watch_periods from existing ratings
-- - Idempotent: inserts only where no completed watch_period exists for that unit
-- - Preserves all existing ratings, season_ratings, watch_periods, and watch_activities
-- - Never creates rewatches or rating-history/feed entries
-- - TV baselines come from season_ratings, plus a 1-season exception when overall gut+detailed is complete
--   (never infers multi-season TV seasons from overall ratings)
-- Review before running. Run Step 2 after Step 1 completes.

-- ============================================================
-- STEP 1: Insert baseline completed watch periods (global)
-- ============================================================
begin;

-- 1) Movies: existing movie rating, no completed watch_period
insert into public.watch_periods (
  user_id, media_id, media_type, season_number, status, started_at, ended_at
)
select
  r.user_id,
  r.media_id,
  'movie'::text,
  null::int,
  'finished'::text,
  coalesce(r.gut_rated_at, r.created_at, r.updated_at)::date as started_at,
  coalesce(r.gut_rated_at, r.created_at, r.updated_at)::date as ended_at
from public.ratings r
join public.media m on m.id = r.media_id
where m.media_type = 'movie'
  and r.gut_rating is not null
  and coalesce(r.gut_rated_at, r.created_at, r.updated_at) is not null
  and not exists (
    select 1
    from public.watch_periods wp
    where wp.user_id = r.user_id
      and wp.media_id = r.media_id
      and wp.media_type = 'movie'
      and wp.status = 'finished'
      and wp.ended_at is not null
  );

-- 2) TV seasons: existing season_rating, no completed watch_period for that season
--    (never inferred from overall TV ratings)
insert into public.watch_periods (
  user_id, media_id, media_type, season_number, status, started_at, ended_at
)
select
  sr.user_id,
  sr.media_id,
  'tv'::text,
  sr.season_number,
  'finished'::text,
  sr.updated_at::date as started_at,
  sr.updated_at::date as ended_at
from public.season_ratings sr
join public.media m on m.id = sr.media_id
where m.media_type = 'tv'
  and sr.season_number >= 1
  and (sr.rating is not null or sr.dnf = true)
  and sr.updated_at is not null
  and not exists (
    select 1
    from public.watch_periods wp
    where wp.user_id = sr.user_id
      and wp.media_id = sr.media_id
      and wp.media_type = 'tv'
      and wp.season_number = sr.season_number
      and wp.status = 'finished'
      and wp.ended_at is not null
  );

-- 3) 1-season TV exception: overall gut+detailed rating implies that sole season watched
--    (only when the show has exactly 1 released regular season; does not infer for multi-season shows)
insert into public.watch_periods (
  user_id, media_id, media_type, season_number, status, started_at, ended_at
)
with single_season_tv as (
  select s.media_id, min(s.season_number) as season_number
  from public.seasons s
  join public.media m on m.id = s.media_id
  where m.media_type = 'tv' and s.season_number >= 1
  group by s.media_id
  having count(*) = 1
)
select
  r.user_id,
  r.media_id,
  'tv'::text,
  ss.season_number,
  'finished'::text,
  coalesce(r.detailed_rated_at, r.gut_rated_at, r.created_at, r.updated_at)::date as started_at,
  coalesce(r.detailed_rated_at, r.gut_rated_at, r.created_at, r.updated_at)::date as ended_at
from public.ratings r
join single_season_tv ss on ss.media_id = r.media_id
where r.gut_rating is not null
  and r.detailed_enjoyment is not null
  and r.detailed_impact is not null
  and r.detailed_recommend is not null
  and r.detailed_watch_again is not null
  and coalesce(r.detailed_rated_at, r.gut_rated_at, r.created_at, r.updated_at) is not null
  and not exists (
    select 1
    from public.watch_periods wp
    where wp.user_id = r.user_id
      and wp.media_id = r.media_id
      and wp.media_type = 'tv'
      and wp.season_number = ss.season_number
      and wp.status = 'finished'
      and wp.ended_at is not null
  );

commit;

-- ============================================================
-- STEP 2 (optional, idempotent): recognize eligible full-series rewatches
-- Run after Step 1. Safe to run broadly; no-ops where ineligible.
-- ============================================================
-- select public.recognize_tv_full_series_rewatches(wp.user_id, wp.media_id)
-- from (
--   select distinct user_id, media_id
--   from public.watch_periods
--   where media_type = 'tv'
-- ) wp;
