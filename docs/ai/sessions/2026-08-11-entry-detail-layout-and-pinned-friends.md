# Entry Detail Layout, Poster Fill, and Compact Pinned Friends (Aug 11, 2026)

## Problem

1. On the entry detail page, Synopsis, Tiebreaker Weight, and Notes lived inside the right-hand info column, crowding the detailed rating block; they should be full-width sections below the poster + rating row.
2. The poster didn't fill the left column — it was a fixed 240×360 box that stopped short of the info column, which ends at "Detailed rating on {date}". The user wanted it to stretch so the top lines up with the title and the bottom with the detailed rating line, even with the right column.
3. Tiebreaker Weight was always shown, including `0`, and dominated the page as a big bold `text-3xl` number with a `/100` suffix.
4. The dashboard showed up to 3 pinned friends as tall full-width cards stacked vertically — lots of wasted vertical space when they could sit side-by-side.

## Changes

### 1. Poster rendering fixes with fixed 2:3 boxes (`43377ea`)
- Gave poster boxes a fixed 2:3 ratio with `object-cover` across `entry-card.tsx`, `ranking-list.tsx`, `tmdb-search.tsx`, the dashboard pinned card (`w-24 h-36`), and the entry detail page.
- Added `images.qualities: [75, 90]` to `next.config.ts`.

### 2. Entry detail layout restructure — Synopsis / Tiebreaker / Notes full-width (`5ad172d`)
- Moved Synopsis, Tiebreaker Weight, and Notes out of the right column. The flex row now holds only the poster + info column (title/status, buttons, gut rating, detailed rating block).
- Below the row, in order: Synopsis (full-width), a centered single-line Tiebreaker ("Tiebreaker Weight 40"), Notes (full-width, only if present), then the Seasons card.
- User chose "move full-width below" over keeping Notes in the right column.

### 3. Poster fills the left column (`5ad172d`)
- **Attempt 1 failed:** `sm:self-stretch` + `sm:aspect-[2/3]` + `sm:w-auto` collapsed the poster to zero width (confirmed via `noposter.jpg` screenshot). Root cause: with `aspect-ratio` + `w-auto` on a flex item, the main size (width) is derived from content *before* stretch applies the cross size — and the `fill` image is absolutely positioned, so it contributes zero intrinsic size and the width resolves to 0.
- **Fix:** a definite width + stretched height: `sm:w-[290px] sm:h-auto sm:self-stretch` (placeholder box too), with `sizes="(min-width: 640px) 290px, 160px"`. Width resolves from the fixed value; height stretches to match the info column (~441px measured from title to "Detailed rating on {date}").
- Since 290:440 ≈ 2:3, `object-cover` crops only ~1–2% — imperceptible. Mobile sizing (`w-40 h-60`) unchanged.

### 4. Tiebreaker Weight — hidden at 0, shrunk (`1b2ffad`)
- The whole block (separator + heading + number) renders only when `entry.weight > 0`.
- Shrunk the number from `text-3xl font-bold` to `text-2xl`, then (per further requests) to `text-sm`, removed bold, dropped the `/100` suffix, and made the label and number the same size.
- `weight` is a plain `number` defaulting to 0; the display only exists on the entry detail page (the edit page slider is untouched).

### 5. Pinned friends — compact row of 3 with inline detailed ratings (`0e6a8a7`)
- Wrapper changed from `space-y-3` (stacked full-width cards) to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3` — one row of 3 on desktop, wrapping gracefully on smaller screens.
- Extracted a `PinnedFriendCard` component (poster `w-20 h-30` = 80×120px — the "in between" size chosen over 96×144 and 64×96, using Tailwind v4's dynamic spacing scale where `h-30` = 120px), `sizes="80px"`.
- Rating rows got `flex-wrap` so the comparison spans wrap in narrow columns.
- **Detailed ratings are always visible**, directly below the friend's + user's gut ratings inside the text column (border-top divider), not expandable. An initial expandable version (toggle button + `expanded` state + ChevronDown/Up) was built and then removed per the user's preference.

## Files changed

- `src/app/(dashboard)/entries/[id]/entry-detail-client.tsx` (layout restructure, poster classes, tiebreaker block)
- `src/app/(dashboard)/dashboard/dashboard-client.tsx` (grid wrapper, new `PinnedFriendCard`)
- `src/components/entry-card.tsx`, `src/components/ranking-list.tsx`, `src/components/tmdb-search.tsx` (poster box fixes)
- `next.config.ts` (`images.qualities`)

## Notes

- Commits: `43377ea`, `5ad172d`, `1b2ffad`, `0e6a8a7`.
- The `aspect-ratio` + `w-auto` flex collapse is a good gotcha to remember: a stretched flex item's main size can't be derived from its cross size via aspect-ratio when it has no intrinsic content — you need a definite main size (`w-[290px]`) plus `self-stretch`.
- Debugging used pixel analysis of screenshots via `sharp` (no headless browser available); reference screenshots (`entrycard*.jpg`, `noposter.jpg`, `pinnedfollow*.jpg`) remain untracked in the repo root.
- `h-30` is valid here because the project is on Tailwind v4 (dynamic spacing scale); it would not exist in v3.
- tsc clean and lint at the pre-existing baseline of 78 problems throughout.
