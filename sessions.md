# Sessions Log — BigOleRankings

A running log of notable work sessions for this project.

---

## 2026-11-14 — Upcoming Releases, New Releases & Release Notifications

**Summary**
- Added **Upcoming Releases** (`/upcoming`, nav: “Upcoming Releases”) for a user’s **Renewed** (`Returning Series`) TV shows: DB-only page load, manual “Update Release Dates” (per-show, with progress/summary), detail-page on-open refresh/persist, and integration with the existing weekly status/refresh cron. Stores upcoming season/release info, per-show last-checked, and season `air_date` data (no TMDB requests on `/upcoming` open).
- Added **New Releases** subsection on `/upcoming` (hidden when empty, exclusive): shows the tracked season premiere that landed within the last **30 days** (rolling, incl. today), resets on a newer season release.
- Added **expected next season** (max known regular season + 1) for shows in **Awaiting Release Date** when no confirmed date is announced.
- Added **upcoming release day push notifications**: around **12:00 PM local time** (fallback **12:00 PM US Eastern**), once per season release for opted-in users who have the show on their Upcoming list, opening `/upcoming`. Detects full-season vs episode drops (with fallback) for message wording. Includes settings toggle/timezone capture, dedupe, and hourly cron processing.
- Updated `AGENTS.md` with novice-friendly explanation guidance (plain-English summary + exactly what to do next).
- Hardened release persistence: preserves prior info/last-successful-check on TMDB failures or incomplete/unreliable responses; avoids duplicate TMDB fetch on detail open by persisting from validated details payload (with safe fallback).

**Key commits (pushed to `origin/master`)**
- `da2be7b` — Add upcoming and new releases for renewed TV shows
- `5a0aaf4` — Show expected next season for awaiting upcoming releases
- `1419e42` — Add upcoming release day push notifications (includes `AGENTS.md` update)

**Migrations (created, not applied by the agent)**
- `supabase/migrations/20261114140000_upcoming_releases.sql`
- `supabase/migrations/20261114150000_upcoming_new_releases.sql`
- `supabase/migrations/20261114160000_upcoming_expected_season.sql`
- `supabase/migrations/20261114170000_upcoming_release_notifications.sql`

**Notes**
- `/upcoming` never auto-fetches TMDB on load; refreshes occur via manual bulk, detail-page persist/refresh, and the existing weekly cron (per existing schedule/eligibility/auth/rate-limiting), with per-show `release_info_last_checked_at`.
- DNF backfill was completed separately in Supabase earlier; backup `public.watch_periods_backup_dnf_fix_20261113` remains (drop only on explicit request: `drop table public.watch_periods_backup_dnf_fix_20261113;`).
- Unrelated untracked local assets (mockups/fonts/icons) were left out of commits.

---

## 2026-11-16 — Viewer Averages Pills & Upcoming Releases Card Improvements

**Summary**
- Added compact **viewer, average gut, and average detailed** stats as three separate pills on entry/title detail views: shows how many users rated a title plus averages (gut, and detailed total when all four detailed scores are present). Placed on the **entry detail** actions row after **Edit** (and visible to viewers), and in the **view-only title** header when ratings exist. Pill colors match `/social` (gut teal, detailed purple).
- Tidied `/upcoming` header layout: removed redundant per-card “Last checked” text and moved the overall **“Last checked (latest)”** line to be centered under **Update Release Dates**.
- **Upcoming card redesign (completed):** removed redundant **Renewed** pills, emphasized premiere/release dates, and added helpful timing hints — countdowns for upcoming premieres (e.g. “in 6 days”, accent for soon) and recency for new releases (e.g. “3 days ago”). Awaiting cards now de-emphasize “Release date not announced”, show **“Season N expected”** when known, and show **“In Production”** when available (instead of “not announced”). Upcoming eligibility was expanded to include shows marked **“In Production”** (in addition to Returning Series) so that status can appear when reported. Improved readability/contrast for these hints while keeping dates primary. (This redesign was stashed during branch cleanup and later restored/applied and pushed in a follow-up session — see 2026-11-18.)

**Key commits (pushed to `origin/master`)**
- `08c4475` — Show viewer, gut, and detailed averages as separate pills
- `a003c89` — Tidy upcoming releases last-checked layout
- `cacb61d` — Add countdown and timing hints to upcoming release cards (restored/applied from stashed `upcoming-card-improvements` work)

**Migrations**
- None added this session. (Earlier episode-tracking migration `supabase/migrations/20261115120000_watch_period_episode_progress.sql` exists from prior work; whether applied in the target environment is unknown.)

**Notes**
- `AGENTS.md`: reviewed; no necessary updates identified this session.
- No “expected release year” is stored for awaiting shows, so the UI shows season/production hints (not invented years). “In Production” only appears when the stored/refreshed source status reports it (use **Update Release Dates** on `/upcoming` to pull latest info).
- Unrelated untracked local assets (mockups/fonts/icons, `src/app/icon.png`) were left out of commits.

---

## 2026-11-18 — Upcoming Card Redesign Shipped & Dashboard Release Countdown Banner

**Summary**
- Restored and shipped the stashed **Upcoming Releases card redesign** (from `upcoming-card-improvements`, `stash@{0}`) and pushed it: countdowns under upcoming premiere dates (e.g. “in X days”/“Tomorrow”/“Today”, with “soon” emphasis) and recency hints for recent releases (e.g. “X days ago”), emphasized dates, awaiting cards showing “Season N expected” or **“In Production”** when available, removed redundant Renewed/status pill on upcoming cards, and expanded upcoming eligibility to include **“In Production”** shows (in addition to Returning Series). Rebased onto latest `origin/master` (automated DB backup commit) before pushing.
- Added a **Release Countdown Banner** to the dashboard header (right of the greeting on desktop, stacked below on mobile): appears when a show on the user’s Upcoming Releases list has a premiere within **7 days** (0–7, local day), showing the soonest qualifying release. Stages: **7–4 days** calm countdown linking to `/upcoming`; **3–1 days** anticipation with pulsing dot and playful copy linking to `/upcoming`; **release day** celebration with shimmer and a **Start watching** button (starts the upcoming season, stays on dashboard with a **“Watching”** confirmation). Uses site theme/accent colors.
- Refined the banner: compact desktop sizing so the banner box matches the height of the 2-line greeting; poster click-to-expand via the existing `PosterLightbox` (poster can be smaller on desktop); moved the `/upcoming` link to the **arrow on the right** (stages 1–2) so expanding the poster does not navigate away.

**Key commits (pushed to `origin/master`)**
- `cacb61d` — Add countdown and timing hints to upcoming release cards
- `d5aee33` — Add release countdown banner to dashboard

**Migrations**
- None added this session.

**Notes**
- Countdown/recency and banner visibility are derived from stored premiere dates and the current local day (no need to re-click “Update Release Dates” just for the day count to decrease); use **Update Release Dates** on `/upcoming` to refresh source info when dates/status change or become known.
- Banner start-watching uses the existing watching flow for the upcoming TV season (handles “already watching” gracefully) and does not require a page navigation on success.
- Unrelated untracked local assets (mockups/fonts/icons, `src/app/icon.png`) were left out of commits.

---

## 2026-11-22 — Season-Only Upcoming Eligibility & Hide Upcoming Shows

**Summary**
- Updated **Upcoming Releases** eligibility so TV shows with **season-only ratings** (a `season_ratings` row but no overall `ratings` entry) can appear on `/upcoming`, as long as the show status is **Returning Series** or **In Production**. Updated refresh/persist auth to accept season-only ownership.
- Added **Hide/Unhide** for Upcoming Releases: users can hide a show from `/upcoming`; hidden shows are excluded from the Upcoming Releases page, dashboard release countdown banner, and upcoming release push notifications. Added a “Show hidden shows” section on `/upcoming` for unhiding.
- Updated release-notification cron to include season-only raters, include **In Production** status consistently, and skip hidden user+show pairs.

**Key commits (pushed to `origin/master`)**
- `8847ad1` — Add upcoming release hiding and season-only eligibility

**Migrations (created, not applied by the agent)**
- `supabase/migrations/20261122120000_upcoming_release_hides.sql`

**Notes**
- Apply the hide migration before using the hide feature in a target environment.
- Hiding is per-user/per-show and only affects upcoming-release tracking/alerts (not normal ratings/entries, watchlist, or detail pages).
- Unrelated untracked local assets (mockups/fonts/icons, `src/app/icon.png`) were left out of commits.


---

## 2026-11-22 — Manual Rewatch Counter on Detail Pages

**Summary**
- Added a simple **manual rewatch counter** on show/movie detail pages so users can log rewatches without entering dates and without using `/watching`. Works for **movies**, **whole TV shows**, and **individual TV seasons**.
- Manual + / - updates only the separate manual counter: no `watch_periods`, no `/watching` history, no `watch_activities`, and no social feed events.
- Detailed card/entry detail shows the combined rewatch total (existing `/watching`-derived rewatches + manual counter). Owners can edit; other logged-in users viewing another user’s entry see the total read-only.
- Added the same compact counter to unrated title detail pages (`/title/[type]/[tmdbId]`) and to entry detail pages (`/entries/[id]`).

**Key files**
- `supabase/migrations/20261122130000_manual_rewatch_counts.sql` — additive `manual_rewatch_counts` table + RLS/policies.
- `src/app/api/rewatches/route.ts` — POST endpoint to increment/decrement manual rewatch count.
- `src/lib/rewatch.ts` — fetch manual counts and include them in movie/TV rewatch totals.
- `src/app/(dashboard)/entries/[id]/page.tsx` — load/pass manual rewatch counts.
- `src/app/(dashboard)/entries/[id]/entry-detail-client.tsx` — compact owner +/- controls and viewer read-only display.
- `src/app/(dashboard)/title/[type]/[tmdbId]/page.tsx` — load/pass manual rewatch counts for title detail.
- `src/app/(dashboard)/title/[type]/[tmdbId]/title-detail-client.tsx` — compact manual rewatch controls on title detail.

**Migrations (created/applied by user)**
- `supabase/migrations/20261122130000_manual_rewatch_counts.sql`

**Notes**
- Manual counter is intentionally separate from `/watching`; the detailed page displays a combined total.
- No destructive DB changes. `npx tsc --noEmit` passed after the changes.
