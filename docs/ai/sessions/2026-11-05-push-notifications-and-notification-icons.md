# Mobile Push Notifications and Notification Icons (Nov 5, 2026)

## Problem

We wanted push notifications for the "detailed rating" flow (nudge users ~7 days after a gut rating), plus control over how those notifications look on Android: the large left icon, the small right icon, and the status-bar badge.

The icon work turned into the bulk of the session. The source art (`bigolerankingsbadge1.svg`, `bigolerankingssmall1.svg`) is exported from Illustrator with most of its geometry at very large **negative** coordinates, while the `viewBox` stays `0 0 720 720`. Rendering those files naively either produces a near-blank PNG (clipped content) or bleeds leftover letter paths ("BIG") into the badge.

## Changes

### 1. Push notification system (`2359012`)

- Deps: `web-push` + `@types/web-push`.
- `public/sw.js` (new): `push` handler merges `event.data.json()` over defaults `{ title: "Big Ole Rankings", url: "/entries", icon: "/icons/notification-icon-192.png", badge: "/icons/notification-badge.png" }` and calls `showNotification` with `data.url`. `notificationclick` focuses an existing window and navigates it, otherwise `openWindow`.
- `src/components/service-worker-register.tsx` (new): registers `/sw.js` with `updateViaCache: "none"`, production only. Mounted from `src/app/(dashboard)/layout.tsx`.
- `supabase/migrations/20261105120000_detailed_rating_reminders.sql` (new):
  - `push_subscriptions` — per device (`endpoint` unique, `p256dh`, `auth`, `active`), RLS "own rows".
  - `scheduled_reminders` — one-shot (`target_type = 'detailed_rating'`, `target_id` = `ratings.media_id`, `scheduled_local_date`, `timezone`), RLS "own rows".
  - `reminder_deliveries` — `(reminder_id, subscription_id)` unique claim, gives exactly-once + a retry path; no policies (cron-only via service role).
  - `notification_settings` — `detailed_rating_reminders` boolean, default `true`, RLS "own rows".
- `src/lib/reminder.ts` (new): `localParts(date, timeZone)` → local `YYYY-MM-DD` + minutes-since-midnight (`en-CA`, `hourCycle: "h23"`); `addDaysToLocalDate`.
- `src/lib/supabase/admin.ts` (new): `createAdminClient()` plus `isAdminServiceKey()` (accepts `sb_secret_…` or a JWT whose `role` is `service_role`) so a bad service key fails loudly instead of silently acting as anon.
- `src/app/api/entries/route.ts`: after writing the rating, skips scheduling when a detailed rating already exists or when `notification_settings.detailed_rating_reminders === false`; otherwise inserts a `scheduled_reminders` row 7 calendar days out in the user's timezone.
- `src/app/api/cron/process-detailed-reminders/route.ts` (new): `Authorization: Bearer $CRON_SECRET` check, VAPID check, then for each reminder whose `scheduled_local_date <=` the user's local date, claims each active subscription via `reminder_deliveries` insert (unique violation `23505` → already delivered, skip), sends with `TTL: 21600`, `topic: "detailed-rating"`. Deactivates subscriptions on `404/410/400/413`; deletes the claim on `429`/`5xx`/unknown so the next run retries.
- `vercel.json`: `process-detailed-reminders` scheduled hourly at `:00` for hours `0`–`23` (so every user's local midnight is covered) alongside the existing weekly `refresh-status`.
- `src/app/(dashboard)/entries/[id]/detailed/page.tsx`: deletes the matching `scheduled_reminders` row on successful submit. `entries/[id]/edit` and `entries/new` received small related wiring.

### 2. Settings: enable/disable + instant test (`8873208`)

- `/settings` gained a **Detailed Rating Reminders** card explaining the ~7-day nudge.
- `enableOnThisDevice()`: requests `Notification` permission, registers the SW, subscribes with `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (`urlBase64ToUint8Array`), upserts `push_subscriptions` on `endpoint` conflict, then automatically fires `POST /api/test-push` with that endpoint so the user immediately sees whether delivery works.
- `disableOnThisDevice()`: `subscription.unsubscribe()` then marks the row `active: false` for that endpoint/user.
- An effect reads `pushManager.getSubscription()` to render the correct toggle state for the current device.
- `src/app/api/test-push/route.ts` (new): requires auth; accepts optional `{ endpoint }` (otherwise the most recently updated active subscription); checks VAPID env; sends the "Successful Notification from BigOleRankings" payload with `icon` + `badge`; deactivates dead subscriptions on `404/410/400/413`.
- New env vars: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.

### 3. Notification icons (`6e28b41` … `5f38833`)

- `6e28b41` — first custom icon: `public/icons/notification-icon.svg` (from `bigolerankingsicon2.svg`) + 192/512 PNGs; SW and payloads gained `icon`/`badge`.
- `f2dee71` — large left icon switched to `bigolerankingslogo1.svg` (`notification-icon.svg` replaced with logo1); badge became a 96×96 white circle with a centered transparent star (from `bigolerankingsicon1.svg`) via `dest-out`.
- `76c36f7` — small right icon: manifest now lists `/icons/notification-small-192.png` **first** (PWA app icon → the icon Android draws on the right of the notification), generated from `bigolerankingssmall1.svg`. Badge source switched to `bigolerankingsbadge1.svg`.
- `096ba3b` / `ae26af0` / `b578b6f` — attempts to extract/normalize the star out of `bigolerankingsbadge1.svg`. All failed in different ways: the star polygons sit around `x ≈ -1722 … -1241`, so a normal render is blank; tightening the viewBox to the star fixed that but still carried the "BIG" letter `<path>` elements into the cutout; a polygon-only rebuild produced thin, mostly-empty geometry.
- `c16e56c` — temporarily used the user-supplied exact PNG `bigolerankingsbadge1.png` (white background + star cutout), byte-for-byte.
- `5f38833` — final state: the user supplied the full badge SVG; the generator now rasterizes `bigolerankingsbadge1.svg` directly (`density: 300`, `resize(96, 96, { fit: "contain" })`, transparent background) into `public/icons/notification-badge.png`. The SVG's own in-viewBox content is a white background with three transparent bar cutouts, which is what ships.

Roles as they stand:

| Slot | Asset | Source |
|------|-------|--------|
| Large left icon (push `icon`) | `/icons/notification-icon-192.png` | `bigolerankingslogo1.svg` → `notification-icon.svg` |
| Right small icon in notification | `/icons/notification-small-192.png` | `bigolerankingssmall1.svg` → `notification-small.svg`, recolored `#4802CE → #5C00C6`, `#C9C9C9 → #FFFFFF` |
| Status-bar badge (push `badge`) | `/icons/notification-badge.png` | `bigolerankingsbadge1.svg` rasterized at 96×96 |

`src/app/manifest.ts` icon order: `notification-small-192.png` first, then `notification-icon-192.png`, `notification-icon-512.png`, `icon-512-maskable.png`, `icon.svg`.

### 4. Grants / permissions

Installing the migration alone still produced `permission denied for table push_subscriptions` (even for the service role). Fixed by:

- Adding `grant usage on schema public` + `grant all` on the four new tables (and all sequences) to `anon`, `authenticated`, `service_role` at the end of the migration.
- Guarding each `create policy` with `drop policy if exists` so the migration can be re-run.
- A one-off, hand-run script `supabase/fix-push-subscriptions-grants.sql` for the already-provisioned project (Supabase SQL editor). It is idempotent.

## Files changed

- `public/sw.js`
- `src/components/service-worker-register.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- `src/app/(dashboard)/entries/new/page.tsx`
- `src/app/(dashboard)/entries/[id]/edit/page.tsx`
- `src/app/(dashboard)/entries/[id]/detailed/page.tsx`
- `src/app/api/entries/route.ts`
- `src/app/api/test-push/route.ts`
- `src/app/api/cron/process-detailed-reminders/route.ts`
- `src/lib/reminder.ts`
- `src/lib/supabase/admin.ts`
- `src/app/manifest.ts`
- `scripts/generate-pwa-icons.mjs`
- `public/icons/notification-icon.svg` / `notification-icon-192.png` / `notification-icon-512.png`
- `public/icons/notification-small.svg` / `notification-small-192.png`
- `public/icons/notification-badge.png` / `notification-badge.svg`
- `bigolerankingsbadge1.svg`, `bigolerankingsbadge1.png`, `bigolerankingssmall1.svg`
- `supabase/migrations/20261105120000_detailed_rating_reminders.sql`
- `supabase/fix-push-subscriptions-grants.sql`
- `vercel.json`, `package.json`, `package-lock.json`
- `docs/ai/sessions/2026-11-05-push-notifications-and-notification-icons.md`

## Notes

- **Required deploy/setup steps**: run the migration *and* `supabase/fix-push-subscriptions-grants.sql` in the Supabase SQL editor; set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` in Vercel; redeploy so `vercel.json` crons register.
- **Same-origin VAPID subject** must be a `mailto:` or `https:` URL — `web-push` rejects anything else.
- **Badge geometry caveat**: `bigolerankingsbadge1.svg` and `bigolerankingssmall1.svg` keep most artwork at negative coordinates outside their `0 0 720 720` viewBox. Anything at negative coords is clipped by any SVG renderer (browser or librsvg), so only the in-viewBox white path (with bar cutouts) survives in the badge. Expanding the viewBox would be required if the full lettering/star artwork is ever wanted.
- **Right small icon updates are device-side**: that icon is the installed PWA's app icon from the manifest. On Android, uninstall/reinstall the PWA (or clear site data) after a manifest/icon change; a push alone won't update it. The `icon` and `badge` fields in the push payload do update immediately on the next notification.
- **Android tints badges**: status-bar badges are treated as masks, so the white circle/background can appear tinted by the system. This is expected and not a bug in the PNG.
- **Icon verification**: the generated badge was checked visually and by pixel sampling (96×96 RGBA; white background with the bar cutouts at `alpha: 0`). `npx tsc --noEmit` / `npm run build` were **not** run in this session.
- **Uncommitted at write-up time**: `bigolerankingssmall1.svg` (path data re-wrapped across lines — no numeric change), the grants edit in `supabase/migrations/20261105120000_detailed_rating_reminders.sql`, and `supabase/fix-push-subscriptions-grants.sql`. Untracked by choice: `bigolerankingsicon1.svg`, the Teko `.ttf` files, and `src/app/icon.png`.
- The old `public/icons/notification-badge.svg` is retained but no longer read by the generator (it rasterizes the root `bigolerankingsbadge1.svg` instead).
