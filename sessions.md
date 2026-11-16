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

## 2026-11-16 — Viewer Averages Pills & Upcoming Releases Card Improvements (in progress)

**Summary**
- Added compact **viewer, average gut, and average detailed** stats as three separate pills on entry/title detail views: shows how many users rated a title plus averages (gut, and detailed total when all four detailed scores are present). Placed on the **entry detail** actions row after **Edit** (and visible to viewers), and in the **view-only title** header when ratings exist. Pill colors match `/social` (gut teal, detailed purple).
- Tidied `/upcoming` header layout: removed redundant per-card “Last checked” text and moved the overall **“Last checked (latest)”** line to be centered under **Update Release Dates**.
- **Upcoming card redesign (on branch, not committed/pushed):** removed redundant **Renewed** pills, emphasized premiere/release dates, and added helpful timing hints — countdowns for upcoming premieres (e.g. “in 6 days”, accent for soon) and recency for new releases (e.g. “3 days ago”). Awaiting cards now de-emphasize “Release date not announced”, show **“Season N expected”** when known, and show **“In Production”** when available (instead of “not announced”). Upcoming eligibility was expanded to include shows marked **“In Production”** (in addition to Returning Series) so that status can appear when reported. Improved readability/contrast for these hints while keeping dates primary.

**Key commits (pushed to `origin/master`)**
- `08c4475` — Show viewer, gut, and detailed averages as separate pills
- `a003c89` — Tidy upcoming releases last-checked layout

**In-progress (not committed/pushed)**
- Branch: `upcoming-card-improvements` (created from `a003c89` on `master`) with uncommitted changes in:
  - `src/app/(dashboard)/upcoming/upcoming-client.tsx`
  - `src/lib/upcoming-releases.ts`
- **Rollback prepared:** to undo these upcoming-card changes, run `git checkout master` (and optionally `git branch -D upcoming-card-improvements` to discard the branch). If later committed on that branch, rollback can be done by reverting/resetting as appropriate.

**Migrations**
- None added this session. (Earlier episode-tracking migration `supabase/migrations/20261115120000_watch_period_episode_progress.sql` exists from prior work; whether applied in the target environment is unknown.)

**Notes**
- `AGENTS.md`: reviewed; no necessary updates identified this session.
- No “expected release year” is stored for awaiting shows, so the UI shows season/production hints (not invented years). “In Production” only appears when the stored/refreshed source status reports it (use **Update Release Dates** on `/upcoming` to pull latest info).
- Unrelated untracked local assets (mockups/fonts/icons, `sessions.md` prior to this update, `src/app/icon.png`) were left out of commits.
