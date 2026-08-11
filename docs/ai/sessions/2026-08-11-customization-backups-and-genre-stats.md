# Customization, Backups, Tooltips, and Genre Stats (Aug 11, 2026)

## Problem

1. Settings was a dumping ground — theme, display name, and password change were missing or in the wrong place (theme should live on the Customization page), and the profile dropdown was cluttered.
2. UI was mostly one look: no way to pick a theme accent color, toggle score chips / media badges / stat chips, or change the page background.
3. Ratings list pages showed no per-season DNF/rating detail — you had to open every entry to see season ratings.
4. TV watch time counted DNF'd seasons, inflating "time watched".
5. The dashboard showed lifetime totals but no recency — "hours watched in the last 30 days" was missing.
6. Deleting a rating left orphaned `media` rows (and their `tv_shows`/`movies`/`seasons`) behind, letting the DB grow unbounded.
7. There was no database backup strategy — and the repo is public, so any backup must be encrypted.
8. The gut/detailed rating fields had no explanation, so it wasn't clear what enjoyment/impact/recommend/watch-again meant.
9. No genre data was stored and there was no stats page — genre-level breakdowns were impossible.

## Changes

### 1. Settings: display name editing + change password (`8e14852`, `c1d24f2`)
- Settings gained a Display Name editor (`supabase.update({ display_name })` on `profiles`) and a Change Password form (`supabase.auth.updateUser({ password })`) with min-length + match validation and success/error feedback.
- Both now live in `src/app/(dashboard)/settings/page.tsx`.

### 2. Theme moved to Customization; slimmer profile dropdown (`ac4cb90`)
- The theme picker moved out of Settings into the Customization page (`selectTheme` writes `profiles.theme` and renders `<ThemeSetter>` live).
- The profile dropdown was slimmed down (`dashboard-nav.tsx`).

### 3. Theme colors, configurable accents, and background colors (`6abb9b2`, `0c5f9a5`, `b53ea13`)
- **9 new theme classes** in `globals.css` (amber, lime, sky, indigo, …) defined with oklch tokens (`--primary`, `--secondary`, `--accent`, `--ring`), with compact swatches in the Customization page.
- **Configurable UI accents** (`0c5f9a5`): new toggles — `score_chips`, `media_badges`, `stat_chips` (defaults all on) — stored in `profiles.customization jsonb` (added to schema + migration with an idempotent `alter table`). New `src/components/score-chip.tsx` and `media-type-badge.tsx`; existing pages (compare, dashboard, entry detail, entry card, ranking list) render them conditionally via `CustomizationProvider` + `mergeCustomization`.
- **Configurable background colors replacing the bg gradient** (`b53ea13`): the gradient was replaced with a selectable flat background; the oklch `L` values for the near-black choices were kept in the `0.21–0.24` range because `L 0.1–0.12` renders as genuinely near-black.

### 4. Expandable season ratings quick view on list pages (`29275de`)
- `ENTRY_SELECT` now embeds `seasons` (with `episode_runtime`); new `FlatSeason` type + `seasons` array on `FlatEntry`.
- `EntryCard` got a "Seasons" expand/collapse row showing each season's name, air year, episode count, and the owner's DNF badge + rating.
- My Ratings and user rankings pages fetch the owner's `season_ratings` (`.eq("user_id", …).in("media_id", tvMediaIds)`) and pass them to `EntriesClient`, which groups them by `media_id`.

### 5. DNF'd seasons excluded from TV watch time (`8b5169a`)
- New `fetchDnfSeasonKeys(supabase, userId)` loads all DNF'd `season_ratings` as `mediaId:seasonNumber` keys.
- `flattenEntry`/`flattenEntries` accept the key set and skip DNF'd seasons when summing `totalRuntime`; dashboard + user pages now pass their keys.

### 6. Dashboard: hours watched in the last 30 days (`77fb9c1`)
- New stat card computed client-side from entries with `created_at >= now - 30d`, summing `runtime` (via the existing `formatMinutes` helper).

### 7. Orphaned media auto-cleanup (`b75bc79`)
- New `cleanup_orphaned_media()` SECURITY DEFINER function + triggers: `on_rating_delete_cleanup` (after delete on `ratings`) and `on_season_rating_delete_cleanup` (after delete on `season_ratings`).
- A media row is deleted when it has no ratings and no season ratings, cascading to its `tv_shows`/`movies`/`seasons` rows.
- Added to both `supabase-schema.sql` and `supabase-migration.sql` (idempotent); migration applied to the live DB.

### 8. Encrypted database backups (`7c1111a`, `5e84b9d`, `835367c`, `9dcd9f1`)
- New `.github/workflows/db-backup.yml`: runs daily at 03:00 UTC + `workflow_dispatch`.
- Dumps via Docker `postgres:17` `pg_dump -Fc`, encrypts with `openssl aes-256-cbc -pbkdf2` using the `BACKUP_PASSPHRASE` secret, keeps the last 14, and commits to `backups/`.
- Debug history worth noting: direct connection failed (IPv6) → switched to the **session-pooler** URI (`SUPABASE_DB_URL`); `pg_dump` 16 vs server 17.6 mismatch → pinned to Docker `postgres:17`.
- First working backup committed as `backups/db-2026-08-11.dump.enc` (452 KB).

### 9. Tooltips for gut and detailed rating fields (`c080be1`)
- New `src/components/ui/tooltip.tsx` (Radix-based) and `@radix-ui/react-tooltip` dependency.
- `detailed-rating-form.tsx`: `FIELD_INFO` map with tooltips for enjoyment/impact/recommend/watch-again.
- `gut-rating-form.tsx`: tooltip explaining the gut rating.

### 10. Genre capture + stats page + follower dropdown (`9e70002`, `f03d43b`)
- **Schema**: `media.genres text[]` in `supabase-schema.sql` + idempotent `alter table media add column if not exists genres text[];` in `supabase-migration.sql` (applied to live DB).
- **Capture**: `/api/tmdb/details` returns `genres`; `/api/entries` POST persists them; new-entry page sends `genres`; `ENTRY_SELECT`/`FlatEntry`/`flattenEntry` carry them.
- **Backfill**: `scripts/backfill-genres.ts` (same pattern as the seasons backfills — TMDB fetch + service-role PATCH, 350ms delay, idempotent). Ran it: **236 rows updated, 0 skipped, 0 failed**; verified `genres is.null` returns zero rows.
- **Stats page**: new server page `src/app/(dashboard)/stats/page.tsx` (auth → fetch own ratings via `ENTRY_SELECT` + `fetchDnfSeasonKeys`) rendering `stats-client.tsx`: overview cards (total rated, avg gut, avg detailed, time watched), a sortable **by-genre** table (count, avg gut/detailed, enjoyment/impact/recommend/watch-again, best pick), a **by-decade** table, and a **Movie vs TV** breakdown. "Stats" link added to the nav.
- **Follower dropdown** (`f03d43b`): the stats page now fetches the profiles of **people you follow** and each of their ratings (per-user flattening so DNF handling stays correct), passing `entriesByUser` to the client. A `Select` in the page header switches between "My stats" and each followed user by name; all cards/tables recompute from the selected user's entries, with a "Stats for · name" subtitle and per-user empty state.

## Files changed

- `src/app/(dashboard)/settings/page.tsx` (display name, password)
- `src/app/(dashboard)/customization/page.tsx` (theme picker moved here, 9 themes + swatches, accent toggles, background color)
- `src/components/dashboard-nav.tsx` (slimmed dropdown, Stats link)
- `src/app/globals.css` (9 theme classes, accent vars, background colors)
- `src/lib/customization.ts`, `src/components/customization-provider.tsx`, `src/components/theme-setter.tsx`
- `src/components/score-chip.tsx` (new), `src/components/media-type-badge.tsx` (new), `src/components/ui/switch.tsx`
- `src/components/entry-card.tsx`, `src/components/ranking-list.tsx`, `src/components/status-badge` (usage)
- `src/app/(dashboard)/dashboard/dashboard-client.tsx`, `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/compare/page.tsx`, `src/app/(dashboard)/entries/[id]/entry-detail-client.tsx`, `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/entries/page.tsx`, `src/app/(dashboard)/users/[username]/page.tsx`, `src/app/(dashboard)/users/[username]/ratings/page.tsx`
- `src/app/(dashboard)/entries/entries-client.tsx`
- `src/lib/entry-queries.ts` (`ENTRY_SELECT` seasons + genres, `FlatSeason`, `flattenEntries(dnfKeys)`, `fetchDnfSeasonKeys`)
- `src/app/api/tmdb/details/route.ts`, `src/app/api/entries/route.ts`, `src/app/(dashboard)/entries/new/page.tsx`
- `src/app/(dashboard)/stats/page.tsx` (new), `src/app/(dashboard)/stats/stats-client.tsx` (new)
- `scripts/backfill-genres.ts` (new)
- `src/components/detailed-rating-form.tsx`, `src/components/gut-rating-form.tsx`, `src/components/ui/tooltip.tsx` (new)
- `supabase-schema.sql`, `supabase-migration.sql`
- `.github/workflows/db-backup.yml` (new), `backups/db-2026-08-11.dump.enc` (new)
- `package.json`, `package-lock.json`

## Notes

- Commits: `29275de`, `8b5169a`, `77fb9c1`, `c1d24f2`, `ac4cb90`, `8e14852`, `6abb9b2`, `0c5f9a5`, `b53ea13`, `b75bc79`, `7c1111a`, `5e84b9d`, `835367c`, `9dcd9f1`, `c080be1`, `9e70002`, `f03d43b`.
- The first encrypted backup (`backups/db-2026-08-11.dump.enc`, 452 KB) is committed; decryption requires the `BACKUP_PASSPHRASE` secret.
- Genre backfill is idempotent and rate-limited (350ms between TMDB calls); a re-run fills any new rows with null genres.
- Stats dropdown lists only followed users' names (no avatars), per request; per-user flattening preserves DNF-aware TV runtime.
