# BigOleRankings

A Next.js app for rating and comparing movies and TV shows with friends. Users create entries for movies/TV shows they've watched, assign gut ratings and optional detailed breakdown scores, and compare rankings with other users — including pinned comparisons on the dashboard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, server/client components) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, `@theme inline` with oklch colors |
| UI | shadcn/ui (Radix primitives, lucide-react icons) |
| Auth | Supabase SSR (`@supabase/ssr`) |
| Database | Supabase PostgreSQL |
| External API | TMDB (movie/TV metadata, search, poster images) |
| Hosting | Vercel |

## Architecture

- **Server components** fetch data from Supabase and pass props to client components
- **Client components** handle interactivity, TMDB API calls, and real-time state
- **API routes** proxy requests to TMDB (keeps `TMDB_ACCESS_TOKEN` server-side)
- **Middleware** (`src/lib/supabase/middleware.ts`) refreshes Supabase auth session on every request
- **Scripts** in `scripts/` use direct Supabase REST API via `SUPABASE_SERVICE_ROLE_KEY`

## Database

### `entries` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| user_id | uuid | FK to auth.users |
| tmdb_id | int | TMDB content ID |
| media_type | text | `'movie'`, `'tv'`, or `'misc'` |
| title | text | Display title |
| poster_path | text | TMDB poster path (appended to `https://image.tmdb.org/t/p/w342`) |
| year | int | Release year |
| runtime | int | Total minutes (nullable) |
| gut_rating | int | 1-100 |
| gut_rated_at | timestamptz | |
| detailed_enjoyment | int | 0-60 |
| detailed_impact | int | 0-20 |
| detailed_recommend | int | 0-10 |
| detailed_watch_again | int | 0-10 |
| detailed_rated_at | timestamptz | |
| weight | int | 0-100, tiebreaker |
| status | text | TV show status from TMDB: `'Returning Series'`, `'Ended'`, `'Canceled'`, etc. (nullable) |
| notes | text | |
| created_at / updated_at | timestamptz | |
| Unique | (user_id, tmdb_id, media_type) | |

### `profiles` table

Key columns: `id` (uuid), `username` (text), `display_name` (text), `theme` (text), `pinned_user_id`, `pinned_user_id_2`, `pinned_user_id_3` (nullable uuid, references auth.users).

## Runtime Calculation

- **Movies**: TMDB `item.runtime` (direct value in minutes)
- **TV shows**: `episode_run_time[0] * number_of_episodes` from main endpoint; if `episode_run_time` is empty, individual season endpoints are fetched and episode runtimes are summed
- **misc**: Treated as movie for TMDB lookups

## Conventions

- **Font**: Geist via `next/font/google`, wired through `--font-geist-sans`/`--font-geist-mono` CSS variables → `--font-sans`/`--font-mono` in `@theme inline`, applied via `font-sans` class on `<body>`
- **Colors**: All defined as CSS custom properties using `oklch()`, mapped in `@theme inline` block in `globals.css`
- **Numeric alignment**: Use `tabular-nums` for scores and ratings
- **TV status badge**: `StatusBadge` renders next to TV titles — `Returning Series` → "Renewed" (green), `Ended` (muted), `Canceled` (red). The next air date (`next_episode_to_air.air_date` from TMDB, returned by `/api/tmdb/details` as `next_air_date`) shows only on the entry detail page (live fetch) and only within 30 days of the air date. Stored `entries.status` is refreshed weekly by the `/api/refresh-status` cron (targets only `Returning Series`/null statuses) and opportunistically patched on the detail page when the live status differs (owner only, via `@/lib/supabase/client` RLS)
- **Auth**: Server components call `createClient()` from `@/lib/supabase/server`, redirect to `/login` if unauthenticated. Client components use `@/lib/supabase/client`.
- **TMDB access**: Never exposed to client — proxied through `/api/tmdb/search` and `/api/tmdb/details`
- **Entry IDs**: Always scoped to the authenticated user — queries filter by `user_id` in addition to `id`

## Key Files

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout, font configuration, `<body>` class |
| `src/app/globals.css` | Tailwind setup, theme variables, color tokens |
| `src/app/(dashboard)/dashboard/dashboard-client.tsx` | Main dashboard client — entries, stats, pinned users, watch time |
| `src/app/(dashboard)/entries/[id]/entry-detail-client.tsx` | Entry detail with TMDB synopsis fetch |
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

## Deployment

- Hosted on Vercel
- Environment variables must include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_ACCESS_TOKEN`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`
- `vercel.json` defines the weekly cron (`/api/refresh-status`, Mondays 12:00 UTC); needs a redeploy after changes, and `CRON_SECRET` must be set in Vercel env vars

