# Shared Ratings on Stats and a Watched Count on Entry Detail (Aug 12, 2026)

## Problem

1. The stats page showed only the selected user's own ratings — there was no way to see how a title was received across multiple people on the app.
2. When present, the stats page's genre/decade tables gave no sense of which titles multiple users had rated in common, or their average scores.
3. On an entry detail page there was no indication of how popular a movie/TV show was — you couldn't tell whether anyone else had watched it without digging into the owner-only followers' card.

## Changes

### 1. "Average Ratings across BigOleRankings" card on the stats page
- **Server aggregation** (`stats/page.tsx`): a new `sharedRatings` query fetches `ratings` rows for all users in scope (self + followed) joined to `media`, then groups by `media_id` in a `Map`, keeping only titles rated by **≥2 distinct users**. Per title it computes:
  - `viewers` = count of distinct users,
  - `avgGut` = mean of gut ratings,
  - `avgDetailed` = mean of detailed totals (enjoyment + impact + recommend + watch-again, i.e. the `/100` score) — only over users who actually have a detailed rating.
- **First iteration** (`stats-client.tsx`): a sortable single table ("Rated by 2+ people") rendered right after the summary stat cards, with a `sharedSort` state (Title / Type / Year / Viewers / Avg Gut / Avg Detailed).
- **Second iteration** (user feedback): renamed to "Average Ratings across BigOleRankings", moved below the **By genre** card (before By decade / Movie vs TV), and split into separate **Movies** and **TV shows** tables (Type column removed, `"type"` dropped from the sort key).
- **Third iteration** (page was too tall): paginated at **10 rows per page**. The user picked the tabs option first — a `Tabs` control (`Movies (n)` / `TV shows (n)`) with one table at a time and a shared page counter reset on tab switch and on sort-header click, with Previous/Next + "Showing X–Y of Z".
- **Fourth iteration**: the user asked whether the two boxes could sit side by side. Confirmed it fits (the layout uses a full-width `container`, and only the Title column is wide). Replaced the Tabs with a `grid md:grid-cols-2 gap-6` of two always-visible boxes, split the shared page counter into **independent `moviePage` / `tvPage`** states, made `paginateShared`/`sharedPager` take a page + setter, and switched Title cells from `whitespace-nowrap` to `truncate max-w-[260px]` so long titles ellipsize instead of forcing a horizontal scrollbar in half-width boxes. Sort stays shared; sorting resets both boxes to page 1.

### 2. Eye-icon watched count on the entry detail page
- **Server** (`entries/[id]/page.tsx`): a lightweight head-count query on `ratings` for the entry's `media_id`:
  `select("user_id", { count: "exact", head: true })` — since `unique(user_id, media_id)` guarantees one row per user, this is exactly the number of users who have the title on the app. Per the user's choices: counts **any entry** (not just gut-rated) across **all users**.
- **Client** (`entry-detail-client.tsx`): a muted pill rendered next to the title in the header row (sibling to `StatusBadge`), styled to match it (`border bg-muted/50 text-muted-foreground text-xs rounded-full px-2 py-0.5`), showing `<Eye>` + the count in `tabular-nums`, with a hover `title` like "5 users watched this" (singular/plural-aware).

## Files changed

- `src/app/(dashboard)/stats/page.tsx` (sharedRatings aggregation, `SharedRating` type exported via client)
- `src/app/(dashboard)/stats/stats-client.tsx` (shared-ratings card: rename, move, Movies/TV split, per-box pagination, sort cleanup)
- `src/app/(dashboard)/entries/[id]/page.tsx` (viewer count query, `viewerCount` prop)
- `src/app/(dashboard)/entries/[id]/entry-detail-client.tsx` (`Eye` import, `viewerCount` prop, header pill)

## Notes

- The two prior iterations (single table, then stacked Movies/TV sections, then Tabs) are kept in git history via `git diff` — the final state is the side-by-side paginated boxes, matching the visual pattern of the "By decade / Movie vs TV" grid below.
- `avgDetailed` averages totals over users *with* a detailed rating only; `viewers` counts every user in scope with an entry regardless of gut/detailed.
- `unique(user_id, media_id)` makes both the viewer count and the ≥2-raters threshold exact — no client-side dedup needed beyond the `Map`/`Set` used to build `sharedMap`.
- Tailwind note: `max-w-[260px]` uses an arbitrary value because the title column width needs to be bounded independently of the table layout.
- tsc clean and lint at the pre-existing baseline of 44 problems throughout.
