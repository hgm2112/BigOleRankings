# Season Ratings, Episode Runtime, and Entry Fixes (Aug 8, 2026)

## Problem

1. All ratings displayed as 0/blank everywhere — `ENTRY_SELECT` omitted the rating columns.
2. The `refresh-status` cron was silently broken and the `seasons` table was empty.
3. TV runtime was missing/null for 49/79 shows (TMDB show-level `episode_run_time` is often empty).
4. On another user's entry: the Seasons card showed the viewer's ratings, allowed editing, and no per-season episode counts were displayed.

## Changes

### 1. `ENTRY_SELECT` rating fields (`d6de53d`)
- Root cause: `ENTRY_SELECT` in `src/lib/entry-queries.ts` selected only `id, user_id, media_id` + media embed — `gut_rating`, `notes`, `weight`, `detailed_*`, and timestamps were never selected, so `flattenEntry` read them as `undefined` and every rating rendered as 0/blank.
- Added the rating columns to `ENTRY_SELECT`; fixes all 8 consumers (dashboard, entries, detail, edit, detailed, compare, profiles).

### 2. Seasons backfill + cron fix (`b958bfb`)
- Root cause: the cron queried `.from("tv_shows").select("media:media_id(tmdb_id)")` — `tv_shows` has no `media_id` column (its `id` is the FK to `media`). Fixed to `media:media(tmdb_id)`.
- Created `scripts/backfill-seasons.ts`; ran it → **360 season rows for 79 shows**, idempotent on re-run.

### 3. Episode runtime moved `tv_shows` → `seasons` (`f8f916f`)
- TMDB's show-level `episode_run_time` is empty for many shows, so `tv_shows.episode_runtime` was null for 49/79 shows; runtimes genuinely vary per season.
- Dropped `tv_shows.episode_runtime`; added `seasons.episode_runtime` = **median of the season's episode runtimes**; TV runtime now computed as `Σ(season.episode_runtime × season.episode_count)`.
- New `scripts/backfill-season-runtime.ts` — fetches each season's episodes from TMDB and upserts the median. Result: **356 filled, 4 skipped** (Yellowjackets S4, Widow's Bay S2, The Pitt S3, Bridgerton S5 — future seasons with `episode_count: 0`), 0 failed, idempotent.
- `supabase-migration.sql` has idempotent ALTERs (`add column if not exists` / `drop column if exists`).
- Live DB verified: 0 seasons with null runtime, `tv_shows.episode_runtime` confirmed dropped.

### 4. Season UX on entry detail (`188bac8`)
- Each season row now shows `· {episode_count} episodes` next to the year (e.g. `Season 1 · 2008 · 7 episodes`).
- `canRateSeasons = isOwner` — on someone else's entry, the Seasons card is **read-only** (no DNF checkbox / rating select).
- `seasonRatings` prop is now fetched by the **entry owner** (`entry.user_id`) instead of the viewer, so the Seasons card shows the owner's DNF/rating labels.
- New display-only **"Season Ratings"** subsection in the "Your Rating" card, fed by new `mySeasonRatings` prop (viewer's own season ratings, ordered by season number). Shows only when the viewer has season ratings.

## Files changed

- `src/lib/entry-queries.ts`
- `src/app/api/refresh-status/route.ts`
- `src/app/api/entries/route.ts`
- `src/app/(dashboard)/entries/[id]/page.tsx`
- `src/app/(dashboard)/entries/[id]/entry-detail-client.tsx`
- `scripts/backfill-seasons.ts`
- `scripts/backfill-season-runtime.ts` (new)
- `supabase-schema.sql`
- `supabase-migration.sql`
- `docs/ai/project.md`

## Notes

- `season_ratings` RLS unchanged: SELECT open to all authenticated users; insert/update/delete restricted to `auth.uid() = user_id`, so the read-only UI is the only gate on other users' entries.
- The 4 skipped seasons are future/announced (0 episodes); the backfill re-run will fill them once TMDB lists episodes.
