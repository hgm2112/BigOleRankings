# BigOleRankings

A Next.js app for rating and comparing movies and TV shows with friends. Users create entries for movies/TV shows they've watched, assign gut ratings and optional detailed breakdown scores, and compare rankings with other users — including pinned comparisons on the dashboard and a Taste Match analysis of how two users' ratings agree.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, server/client components) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, `@theme inline` with oklch colors |
| UI | shadcn/ui (Radix primitives, lucide-react icons) |
| Auth | Supabase SSR (`@supabase/ssr`) |
| Database | Supabase PostgreSQL |
| Charts | recharts (`ChartContainer` wrapper, see Conventions) |
| External API | TMDB (movie/TV metadata, search, poster images) |
| Hosting | Vercel |

## Architecture

- **Server components** fetch data from Supabase and pass props to client components
- **Client components** handle interactivity, TMDB API calls, and real-time state
- **API routes** proxy requests to TMDB (keeps `TMDB_ACCESS_TOKEN` server-side), create entries (`POST /api/entries`), and paginate the `/social` feed (`/api/social/feed`)
- **Middleware** (`src/lib/supabase/middleware.ts`) refreshes Supabase auth session on every request
- **Scripts** in `scripts/` use direct Supabase REST API via `SUPABASE_SERVICE_ROLE_KEY`

## Database

The model was split (2026-08-08) from one denormalized `entries` table into shared media + per-user ratings. `src/lib/entry-queries.ts` (`ENTRY_SELECT` + `flattenEntry`) joins the pieces back into a flat "entry" shape so the rest of the app doesn't care. A fresh install uses `supabase-schema.sql`; an existing install migrates via `supabase-migration.sql` (preserves the old table as `entries_old`). Later DDL (e.g. `feed_likes`) ships only in `supabase-schema.sql` — existing installs paste it into the Supabase SQL editor directly, since DDL can't run through PostgREST.

### `media` table — shared metadata, deduped by `(tmdb_id, media_type)`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| tmdb_id | int | TMDB content ID |
| media_type | text | `'movie'` or `'tv'` (legacy `'misc'` is reclassified to `'movie'` on migrate) |
| title | text | Display title |
| poster_path | text | TMDB poster path (appended to `https://image.tmdb.org/t/p/w342`) |
| year | int | Release year |
| created_at / updated_at | timestamptz | |
| Unique | (tmdb_id, media_type) | |

### `movies` / `tv_shows` — per-type extensions (PK is `media.id`)

- `movies`: `runtime` (int, minutes)
- `tv_shows`: `status` (`'Returning Series'`, `'Ended'`, `'Canceled'`, …), `next_air_date` (date), `network`

### `seasons` — real seasons from TMDB (special "season 0" never stored)

Columns: `id`, `media_id` (FK), `season_number`, `name`, `air_year`, `episode_count`, `episode_runtime`. Unique `(media_id, season_number)`. Rows are populated by the refresh-status cron / `scripts/backfill-seasons.ts`; `episode_runtime` is the median episode length for that season, derived from TMDB season endpoints by `scripts/backfill-season-runtime.ts` (the show-level `tv_shows.episode_runtime` column was dropped because TMDB's `episode_run_time` is empty for many shows and runtimes vary per season).

### `ratings` — one row per `(user_id, media_id)`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK to auth.users |
| media_id | uuid | FK to media |
| notes | text | |
| gut_rating | int | 1-100 |
| gut_rated_at | timestamptz | |
| detailed_enjoyment / impact / recommend / watch_again | int | 0-60 / 0-20 / 0-10 / 0-10 |
| detailed_rated_at | timestamptz | |
| weight | int | 0-100, tiebreaker |
| created_at / updated_at | timestamptz | |
| Unique | (user_id, media_id) | |

### `season_ratings` — per-user per-season 1-10 + DNF

Columns: `id`, `user_id`, `media_id`, `season_number`, `rating` (1-10), `dnf` (bool, default false), `updated_at`. Unique `(user_id, media_id, season_number)`. Composite FK `(media_id, season_number)` → `seasons` guarantees a rating can only exist for a real season.

### `profiles` table

Key columns: `id` (uuid), `username` (text), `display_name` (text), `theme` (text), `pinned_user_id`, `pinned_user_id_2`, `pinned_user_id_3` (nullable uuid, references auth.users).

New signups auto-pin **and** auto-follow user `rise` (default friend) via `handle_new_user()` — only while the user has no pinned friend and only if `rise` exists. Existing installs run `supabase-migration-default-pin.sql` once (same guard: skips users who already pinned someone). The `/social` page shows a **Suggested Friends** card (friends-of-friends first, then rating count, top 5) only while the viewer follows ≤2 people.

### `feed_likes` — likes on derived `/social` feed events

`id`, `user_id` (FK profiles, cascade), `event_key` (text, e.g. `gut:{ratingId}`, `detailed:{ratingId}`, `season:{userId}:{mediaId}:{n}`), `created_at`. Unique `(user_id, event_key)`. RLS: select for all authenticated, insert/delete own rows. `fetchSocialFeed` attaches `like_count` / `liked_by_me` / `likers` to every event; orphaned likes (rating deleted) never render.

## Runtime Calculation

- **Movies**: `movies.runtime` from TMDB (direct value in minutes)
- **TV shows**: `Σ(season.episode_runtime × season.episode_count)` across seasons; `runtime` null on the flat entry if no season runtime is known

## Compare & Stats Analytics

All comparison math is pure — no React, no Supabase — in `src/lib/compare-stats.ts`. `computeComparison` covers gut agreement (Pearson + Spearman, mean absolute and signed gap, ±5/±10/±20 counts, match score `100 − MAD`), per-dimension stats, a least-squares prediction fit, genre gaps, bucket distribution, and extremes. `computeSeasonAgreement` does the same over `(media_id, season_number)` pairs from `season_ratings` (TV titles only) plus DNF overlap. Labels come from `correlationLabel()` (≥0.85 "Twin flames" … <0 "Complete opposites") and `scoreLabel()` (≥90 "Scary close" … "Frenemies").

- **`/compare`** renders `TasteMatchSection` above the side-by-side table: match ring + 6 KPI cards (including movie/TV correlation split by `media_type`), gut scatter with a y=x reference line, radar + per-dimension table (Enjoyment /60, Impact /20, Recommend /10, Watch Again /10), grouped histogram, prediction chart with regression line, genre diverging bars, agreements/fights/top-10 lists, and the season-by-season section.
- **`/stats`** renders `StatsCharts` (rating spread, monthly activity, detailed breakdown, movie vs TV, top genres) after the KPI grid, and `SharedRatingsChart` inside Global Stats.
- **Metric help**: 27 contextual explainers in `src/components/compare/metric-help.tsx` — a static definition plus a reading interpolated from the live values (sample sizes, correlation labels, per-dimension `n`). Copy uses display names, never "you": `/compare` picks both people from search as `User 1`/`User 2`, so there is no notion of "self". All of them open through `InfoButton`; the detailed-rating form uses the same `Popover` pattern inline (its `FIELD_INFO` map) rather than `InfoButton`.
- Cards render `—` instead of a misleading number when a stat needs ≥3 paired values (Pearson returns `null` below that).

## Conventions

- **Font**: Geist via `next/font/google`, wired through `--font-geist-sans`/`--font-geist-mono` CSS variables → `--font-sans`/`--font-mono` in `@theme inline`, applied via `font-sans` class on `<body>`
- **Colors**: All defined as CSS custom properties using `oklch()`, mapped in `@theme inline` block in `globals.css`
- **Numeric alignment**: Use `tabular-nums` for scores and ratings
- **TV status badge**: `StatusBadge` renders next to TV titles — `Returning Series` → "Renewed" (green), `Ended` (muted), `Canceled` (red). The next air date (`next_episode_to_air.air_date` from TMDB, returned by `/api/tmdb/details` as `next_air_date`) shows only on the entry detail page (live fetch) and only within 30 days of the air date. Stored `tv_shows.status` is refreshed weekly by the `/api/refresh-status` cron (targets only `Returning Series`/null statuses) and opportunistically patched on the detail page when the live status differs (owner only, via `@/lib/supabase/client` RLS). The same cron upserts `seasons` rows for each TV show (once per show), which are required before per-season ratings can be written.
- **Auth**: Server components call `createClient()` from `@/lib/supabase/server`, redirect to `/login` if unauthenticated. Client components use `@/lib/supabase/client`.
- **Season rating editing**: `SeasonRatingsEditor` (`src/components/season-ratings-editor.tsx`) is the only write UI — used by `/entries/new` (staged, sent as `season_ratings` in the `POST /api/entries` body so they land in the same request that creates the `seasons` rows) and `/entries/[id]/edit` (staged, upserted/deleted together with the gut/detailed save). The entry detail page is view-only for seasons. The select has an explicit "Clear" item (`value="clear"` → `rating: null`) because Radix `Select` has no deselect.
- **TMDB access**: Never exposed to client — proxied through `/api/tmdb/search` and `/api/tmdb/details`
- **Charts**: recharts children must be wrapped in `<ChartContainer>` from `@/components/ui/chart` (hand-written shadcn primitives — this repo has no `components.json`, so there's no `npx shadcn add` path). Without it `ResponsiveContainer` measures 0×0 and the chart silently renders nothing, and SSR always shows an empty frame because `ResizeObserver` only runs client-side. Colors are `--chart-1..5` in `:root` of `globals.css`, surfaced as `chart-N` theme tokens and as `USER_1_COLOR`/`USER_2_COLOR` (`src/components/charts/chart-colors.ts`); `@theme inline` maps them via `var(--chart-N)` so custom themes override them.
- **Info popovers**: `InfoButton` (Radix `Popover` + lucide `Info`, toggles on click, works on touch) must sit in a parent with `gap-2` — the trigger is `-m-2 p-2`, so the 30px touch target adds no layout width. `PopoverContent` is portaled, so it doesn't clip inside scrollable tables.
- **Entry IDs**: Always scoped to the authenticated user — queries filter by `user_id` in addition to `id`
- **Social feed**: `/social` derives events from rating timestamps — there is no activity table. Gut events come from `ratings.gut_rated_at`, detailed from `detailed_rated_at`, season from `season_ratings.updated_at` (keyed `gut:{ratingId}`, `detailed:{ratingId}`, `season:{userId}:{mediaId}:{n}`). Audience is the viewer + the people they follow. The page server-renders the first 30 (the only page size — `FEED_DEFAULT_LIMIT` = `FEED_MAX_LIMIT` = 30); "Load more" hits `/api/social/feed?before=<timestamp>&limit=` with the last event's timestamp as cursor. Every event shows date *and* time (`toLocaleString`), a `Film`/`Tv` icon, and a like toggle backed by `feed_likes` (count + liker list popover). Placement: between the Search and Following cards.
- **Sliders**: the shared `src/components/ui/slider.tsx` root carries `py-2` plus a `before:-inset-y-3 before:inset-x-0` strip (~46px tall) so tapping anywhere on the bar jumps the thumb — the Radix root itself is only as tall as the thumb (absolutely positioned), so without the strip the hit area is ~6px. Radix 1.4 already jumps to a non-thumb pointerdown natively.

## Key Files

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout, font configuration, `<body>` class |
| `src/app/globals.css` | Tailwind setup, theme variables, color tokens |
| `src/app/(dashboard)/dashboard/dashboard-client.tsx` | Main dashboard client — entries, stats, pinned users, watch time |
| `src/app/(dashboard)/compare/page.tsx` | Two-user comparison — search, side-by-side table, Taste Match wiring |
| `src/lib/compare-stats.ts` | Pure gut/dimension/season comparison statistics + labels |
| `src/components/compare/taste-match.tsx` | Taste Match section orchestrator (KPIs, tables, card layout) |
| `src/components/compare/taste-charts.tsx` | Scatter, radar, prediction, genre, and dimension bar charts |
| `src/components/compare/season-agreement.tsx` | Season-by-season agreement + DNF overlap |
| `src/components/compare/metric-help.tsx` | Contextual explainers for every compare metric |
| `src/components/info-button.tsx` | Click-to-toggle info popover primitive |
| `src/lib/social-feed.ts` | `/social` activity feed fetcher — derives gut/detailed/season events from rating timestamps, cursor pagination |
| `src/components/social/social-feed.tsx` | Recent Activity feed card (initial page server-rendered, Load more via `/api/social/feed`) |
| `src/app/(dashboard)/social/page.tsx` | `/social` server page — feed + follows + suggested friends |
| `src/app/(dashboard)/social/social-client.tsx` | User search / follow / pin UI + Suggested Friends card (shown while following ≤2 people) |
| `src/app/api/social/feed/route.ts` | Feed load-more endpoint (401 unauthenticated, `?before=&limit=` cursor) |
| `src/app/api/entries/route.ts` | `POST /api/entries` — media + type extension + seasons upsert, then rating, then staged `season_ratings` |
| `src/app/(dashboard)/entries/new/page.tsx` | New entry form — gut rating + notes + season ratings |
| `src/app/(dashboard)/entries/[id]/edit/page.tsx` | Edit form — gut, detailed, season ratings, weight, delete |
| `src/components/ui/slider.tsx` | Shared slider with enlarged tap strip (see Conventions) |
| `src/components/ui/chart.tsx` | Hand-written shadcn chart primitives (container, tooltip, legend) |
| `src/components/charts/rating-distribution.tsx` | Shared gut-rating histogram |
| `src/components/stats-charts.tsx` | `/stats` chart suite + shared-ratings chart |
| `src/app/(dashboard)/entries/[id]/entry-detail-client.tsx` | Entry detail with TMDB synopsis fetch (seasons view-only) |
| `src/components/season-ratings-editor.tsx` | Shared per-season DNF + 1-10 editor (new-entry + edit forms) |
| `src/app/(dashboard)/entries/[id]/page.tsx` | Entry detail server component |
| `src/app/auth/callback/route.ts` | Supabase auth callback handler |
| `src/app/api/tmdb/details/route.ts` | TMDB detail proxy (runtime, overview, etc.) |
| `src/app/api/tmdb/search/route.ts` | TMDB search proxy |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server Supabase client |
| `src/components/status-badge.tsx` | TV status pill (Renewed/Ended/Canceled), optional next air date |
| `src/app/api/refresh-status/route.ts` | Weekly cron (Vercel) that refreshes TV `status` from TMDB |
| `scripts/backfill-runtime.ts` | Backfill runtime from TMDB main endpoint |
| `scripts/backfill-runtime-pass2.ts` | Backfill runtime from TMDB season endpoints |
| `scripts/backfill-status.ts` | Backfill TV status from TMDB |
| `scripts/backfill-seasons.ts` | Backfill `seasons` rows from TMDB |
| `scripts/backfill-season-runtime.ts` | Backfill `seasons.episode_runtime` (median of per-episode runtimes) |

## Deployment

- Hosted on Vercel
- Environment variables must include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_ACCESS_TOKEN`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`
- `vercel.json` defines the weekly cron (`/api/refresh-status`, Mondays 12:00 UTC); needs a redeploy after changes, and `CRON_SECRET` must be set in Vercel env vars

