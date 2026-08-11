# View-Only Full Rankings Page for Users (Aug 10, 2026)

## Problem

1. A user's dashboard only showed Top 10 / Worst 10 rankings — there was no way to browse their full movie/TV list.
2. Reusing the "My Ratings" page for this surfaced two bugs: changing the sort on another user's list navigated to your own `/entries` (the replace URL was hardcoded), and the entry detail "Back to entries" link returned to your own list instead of the user's.

## Changes

### 1. New route `/users/[username]/ratings` — view-only full rankings
- New server page `src/app/(dashboard)/users/[username]/ratings/page.tsx`: auth check → redirect to `/login`, look up the profile by username → `notFound()` if missing, fetch the user's ratings via `ENTRY_SELECT`, then render `EntriesClient`.
- Shows all of the user's entries with the same sort dropdown + All/Movies/TV tabs as "My Ratings", but read-only: `readOnly` + `showAddButton={false}`.
- Title: "{name}'s Ratings"; the subtitle is a link "Back to {name}'s dashboard" → `/users/{username}`.

### 2. `EntriesClient` made reusable (`entries-client.tsx`)
- New props: `title`, `description` (ReactNode), `showAddButton`, `readOnly`, `basePath` (default `/entries`).
- Sort navigation (`applySort`) now replaces with `basePath` instead of a hardcoded `/entries` — fixes sorting on another user's list jumping to your own.
- `backQuery` now includes `back={basePath}` so the entry detail page knows the origin list.
- Empty state and header are configurable; the Add Entry button is hidden when `showAddButton={false}`.

### 3. `EntryCard` read-only mode (`entry-card.tsx`)
- New `readOnly` prop hides the Edit button (Delete was already hidden when `onDelete` is undefined).

### 4. "See {name}'s full rankings" link on user dashboards (`dashboard-client.tsx`, `users/[username]/page.tsx`)
- New `fullRankingsHref` prop on `DashboardClient`; when set, renders a card link with a `ListChecks` icon just below the stats grid (Total Entries / Movies / TV Shows / etc.).
- The user page passes `fullRankingsHref={/users/{username}/ratings}`. The own dashboard is unaffected.
- Pinned-card follower names now stand out: header name is `font-semibold text-foreground`, rating-row labels are `font-medium text-foreground` (same size, dropped the muted gray).

### 5. Entry detail back link (`entries/[id]/page.tsx`)
- Reads a `back` search param (validated to start with `/` but not `//` to avoid protocol-relative URLs) to build `backUrl`, so "Back to entries" returns to the user's ratings list with sort/dir preserved.

## Files changed

- `src/app/(dashboard)/users/[username]/ratings/page.tsx` (new)
- `src/app/(dashboard)/entries/entries-client.tsx`
- `src/components/entry-card.tsx`
- `src/app/(dashboard)/dashboard/dashboard-client.tsx`
- `src/app/(dashboard)/users/[username]/page.tsx`
- `src/app/(dashboard)/entries/[id]/page.tsx`

## Notes

- The entry detail page was already viewable by any logged-in user (`isOwner` gates editing), so `/entries/{id}` row links work in read-only mode without extra access changes.
- Committed as `c9911d4` — "Add view-only full rankings page for users".
