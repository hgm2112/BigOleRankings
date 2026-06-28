# Entry Detail Overhaul (Jun 28, 2026)

## Problem
Clicking a pinned follower's movie/TV title from the dashboard 404'd because `entries/[id]/page.tsx` filtered by both `id` AND `user_id`, blocking cross-user entry viewing.

## Changes

### `entries/[id]/page.tsx`
- Removed `.eq("user_id", user.id)` filter so any authenticated user can view any entry (RLS already allowed it)
- Now fetches `ownerProfile` (entry owner's `username`/`display_name`) and the current user's own matching entry (`tmdb_id` + `media_type`) for comparison
- When `isOwner`, also fetches followers' ratings: queries `follows` for `following_id = user.id`, then fetches each follower's entry for the same title

### `entries/[id]/entry-detail-client.tsx`
- Shows **"Entry by {name}"** subtitle when viewing another user's entry
- **Hides Edit/Add Detailed buttons** for non-owners
- **"Your Rating" card** — shows your gut/detailed rating with colored Δ vs the entry owner; clickable to your own entry
- **"Followers' Ratings" card** — shows all followers who rated the same title, with gut rating + Δ, detailed E/I/R/W + Δ; follower names link to `/users/{username}`

### `dashboard/dashboard-client.tsx`
- Added **"Last 10 Rated" tab** alongside Gut/Detailed — two side-by-side cards showing most recently gut-rated entries (with "Due by {date}" for pending detailed) and most recently detailed-rated entries

## Files touched
- `src/app/(dashboard)/entries/[id]/page.tsx`
- `src/app/(dashboard)/entries/[id]/entry-detail-client.tsx`
- `src/app/(dashboard)/dashboard/dashboard-client.tsx`
