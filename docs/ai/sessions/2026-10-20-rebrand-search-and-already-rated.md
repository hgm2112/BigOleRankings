# Rebrand, Entry Search, and Already-Rated Guard (Oct 20, 2026)

## Problem

1. The site still used the old Teko/Geist Sans type pairing and a black default background. We wanted to move to the new brand: BaiJamjuree as the single site font, the long BigOleRankings logo, a purple default theme, and the new favicon.
2. `/entries` (and the shared `/users/[username]/ratings` view) had no way to search within a growing list of rated titles.
3. The Add Rating flow let users pick a title they had already rated, only failing on submit with a `409` ("You've already rated this title!"). Direct links (`/entries/new?tmdb_id=...`) bypassed even that search-level awareness.
4. On `/login`, the "Get in here you old so and so!" tagline sat left-aligned under the full-width logo.

## Changes

### 1. Rebrand (`17679a1`)

- `src/app/layout.tsx`: loaded BaiJamjuree via `localFont` with 10 faces (uprights 200–700, italics 400–700), exposed as `--font-bai-jamjuree`; kept `Geist_Mono` for code; removed Teko and Geist Sans.
- `src/app/globals.css`:
  - `--font-sans: var(--font-bai-jamjuree)`.
  - `--primary` / `--ring` set to `oklch(0.421 0.251 282)` (#4802CE); `--accent` to `oklch(0.836 0 0 / 0.12)` (#C9C9C9).
  - Purple defaults for background/card/popover/muted/border/input in both `:root` and `.dark`; added a `.bg-black` class.
  - Removed the per-`theme-*` `--accent` overrides, the `--font-display` token and `h1,h2` display rule, and the ×1.2 `@theme` text-scale bump.
- `src/lib/customization.ts`: `DEFAULT_CUSTOMIZATION.background = "purple"`.
- `src/components/customization-provider.tsx`: always applies `bg-${prefs.background}` (dropped the old `"black"` special case).
- `supabase-schema.sql`: both customization defaults updated to include `"poster_themes": false, "background": "purple"`.
- `supabase-migration.sql`: new section 9 — changes the column default and field-wise backfills untouched users to purple. **Must be run manually in the Supabase SQL editor.**
- Favicon: `src/app/icon.svg` replaced with the white + `#7933FF` mark (from `bigolerankingsicon2.svg`); removed `src/app/icon.png`.
- Logo: added `public/bigolerankingslogolong1.svg`; `dashboard-nav.tsx` renders it at `h-11` with `unoptimized`; `auth-blurb.tsx` uses it full-width in all three variants.
- `.gitignore`: added `*:Zone.Identifier`.

### 2. Search on `/entries` (`entries-client.tsx`)

- Added a `query` state and a `filtered` memo (case-insensitive title `includes`) applied after sorting.
- Tab labels now show totals (`totalMovies` / `totalTvShows`) while the lists themselves use the filtered results.
- Added a `w-64` search input (with a `Search` icon) after `TabsList`; the header row is now `flex flex-wrap` with the sort controls pushed right via `ml-auto`.
- Empty state per tab: `No matches for “{query}”.`
- The same component powers `/users/[username]/ratings`, so that page gets the search too.

### 3. Already-rated detection in Add Rating

- `src/app/api/tmdb/search/route.ts`: after the TMDB request, resolves the signed-in user and does two lookups (`media` by `tmdb_id` + `media_type`, then `ratings` by `user_id` + `media_id`). Results now include `already_rated: boolean` and `entry_id: string | null`. Signed-out users get `false` / `null`.
- `src/components/tmdb-search.tsx`: `TMDBResult` carries the two new fields. Already-rated results stay visible with an "Already rated" badge and a **View rating** link to `/entries/{entry_id}`; the card no longer selects on click.
- `src/app/(dashboard)/entries/new/page.tsx`: direct `?tmdb_id=&media_type=` links check `media` → `ratings` before loading details and instead show a notice card ("You've already rated this title.") with **View rating** and **Back to search**. `handleSelect` also short-circuits for flagged results. The POST `409` remains as a fallback.

### 4. Centered login tagline (`auth-blurb.tsx`)

- Added `text-center` to the login variant's tagline paragraph so it centers under the full-width logo. Register/default variants are unchanged.

## Files changed

- `src/app/(dashboard)/entries/entries-client.tsx`
- `src/app/(dashboard)/entries/new/page.tsx`
- `src/app/api/tmdb/search/route.ts`
- `src/components/tmdb-search.tsx`
- `src/components/auth-blurb.tsx`
- `docs/ai/sessions/2026-10-20-rebrand-search-and-already-rated.md`

(The rebrand commit `17679a1` additionally touched `layout.tsx`, `globals.css`, `customization.ts`, `customization-provider.tsx`, `dashboard-nav.tsx`, `icon.svg`, the SQL files, fonts, and logo assets.)

## Notes

- `npx tsc --noEmit` and `npm run build` pass. `npm run lint` reports 74 pre-existing problems (70 errors, 4 warnings); no new ones.
- The purple backfill migration in `supabase-migration.sql` still needs to be run manually in Supabase.
- `bigolerankingsicon1.svg` and the unused Teko font files remain untracked on purpose (rejected variants).
- PWA icons and `manifest.ts` colors were intentionally left untouched.
