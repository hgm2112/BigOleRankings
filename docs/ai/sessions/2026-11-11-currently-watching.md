# Currently Watching, Watch History, and Follow-up Feed/UI Fixes (Nov 11, 2026)

## Problem

Users needed a way to track movies and TV shows they are actively watching (with start/end dates, duration, and history) separately from ratings, including per-season TV progress, resumable periods, and visibility in the social feed and pinned-friend cards. Follow-up requests refined the TV finish/rating flow, `/watching` and dashboard layouts/ordering, and social feed labeling.

## Changes

### 1. Currently watching with season tracking, watch history, and social integration (`e1dabb9`)

- **Database** (`supabase/migrations/20261111120000_currently_watching.sql`, `supabase-schema.sql`): added `public.watch_periods` (per-user watch history for movies and per-TV-season; statuses `currently_watching`, `finished`, `dnf`, `stopped`; `started_at`/`ended_at`; constraints for media/season/date/status consistency, TV season FK to `seasons`, unique partial index enforcing one active period per movie/season, indexes, RLS policies, `updated_at` trigger, grants) and append-only `public.watch_activities` (meaningful feed events: `started`, `finished`, `stopped`, `dnf` with `occurred_at`, linked to `period_id`/media/season; select/insert RLS, indexes, grants; no update/delete policies by default).
- **Library/API** (`src/lib/watching.ts`, `src/app/api/watching/route.ts`): watch types and select/normalize helpers, date/duration utilities, fetch helpers; mutations for `start`, `transition` (finish/pause/DNF), `resume_new_period` (new period, prior history preserved), `update_dates`, `delete`, and `undo_finish` (reverts a finished period to active and removes the finished feed activity/likes for consistency). Ensures media/TV season rows as needed and cleans up associated `feed_likes` when removing watch activities.
- **UI** (`src/app/(dashboard)/watching/page.tsx`, `src/app/(dashboard)/watching/watching-client.tsx`, `src/components/dashboard-nav.tsx`): `/watching` page to add titles via TMDB search (including already-rated titles for new seasons), choose season/start date, and manage active/history periods (finish/pause/DNF/resume, edit dates, delete). TV finish dialog commits on confirm with optional season rating and `Save` / `Rate show` / `Save & Watch Next Season` (when available) flows; season/overall ratings remain independent and optional. Added Watching to dashboard navigation.
- **Social/dashboard integration** (`src/lib/social-feed.ts`, `src/components/social/social-feed.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/dashboard/dashboard-client.tsx`, `src/components/tmdb-search.tsx`, `src/app/(dashboard)/entries/new/page.tsx`, `src/app/(dashboard)/entries/[id]/edit/page.tsx`): merged append-only watch activities into the feed as `watch:{activityId}` events (no events on date corrections), added pinned-friend **Currently Watching / Last Rated** tabs with recency-based default, and carried prior season ratings / `returnTo` context into rating flows.

### 2. Pinned currently watching collapsed by default (`fcddd19`)

- `src/app/(dashboard)/dashboard/dashboard-client.tsx`: pinned-friend Currently Watching shows only the latest active item by default (ordered by `started_at desc, created_at desc`), with a chevron toggle to expand/collapse the rest when multiple items exist.

### 3. Social feed rating verb distinction (`db77466`)

- `src/components/social/social-feed.tsx`: gut rating events now display as **`gut-rated`** (replacing `rated`) and are visually distinguished from **`detailed-rated`** with distinct inline label styling; other activity verbs keep muted styling.

## Key decisions

- **New-period-on-resume**: resuming a stopped period creates a new active period; prior periods/history are preserved.
- **Append-only watch feed events**: meaningful actions emit `watch_activities` (`watch:{activityId}`) once; date corrections do not emit or duplicate events. `feed_likes` use stable event keys and are cleaned up when finished activities are removed (e.g. delete/undo flows).
- **History separate from ratings**: watch tracking uses normalized `watch_periods`/`watch_activities`, not booleans on ratings/media.
- **Ratings remain independent/optional**: season ratings are per-season, optional overall show rating is never auto-averaged from seasons, movies keep the existing rating flow, and gut vs detailed distinction is preserved.
- **TV season completion**: finishing a season does not auto-finish the overall show.
- **UI semantics**: internal status/event value `stopped` is surfaced as Pause/Paused; active watching ordered by `started_at desc, created_at desc`.

## Files changed

- `supabase/migrations/20261111120000_currently_watching.sql`, `supabase-schema.sql`
- `src/lib/watching.ts`, `src/lib/social-feed.ts`
- `src/app/api/watching/route.ts`
- `src/app/(dashboard)/watching/page.tsx`, `src/app/(dashboard)/watching/watching-client.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/dashboard/dashboard-client.tsx`
- `src/components/social/social-feed.tsx`, `src/components/tmdb-search.tsx`, `src/components/dashboard-nav.tsx`
- `src/app/(dashboard)/entries/new/page.tsx`, `src/app/(dashboard)/entries/[id]/edit/page.tsx`
- `docs/ai/project.md`, `docs/ai/sessions/2026-11-11-currently-watching.md`

## Notes

- **Migration required**: apply `supabase/migrations/20261111120000_currently_watching.sql` (or equivalent schema changes) to the live Supabase database for the feature to work in production.
- **Environment**: TMDB-backed flows require `TMDB_ACCESS_TOKEN` for `/api/tmdb/search` and `/api/tmdb/details`.
- **Commits**: `e1dabb9` (feature), `fcddd19` (pinned watching collapse), `db77466` (gut-rated/detailed-rated distinction), all pushed to `origin/master`.
- **Not run**: tests, lint, type checks, and builds were not run for these changes.
- **Left uncommitted on purpose** (pre-existing/unrelated local files): modified `bigolerankingssmall1.svg`; untracked `bigolerankingsicon1.svg`, `fonts/Teko-*.ttf`, `src/app/icon.png`.
