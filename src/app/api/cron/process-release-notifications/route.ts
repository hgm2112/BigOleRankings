import type { NextRequest } from "next/server"
import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"
import { localParts } from "@/lib/reminder"

export const maxDuration = 60

const FALLBACK_TZ = "America/New_York"

function normalizeTz(tz: string | null | undefined): string {
  const candidate = (tz || "").trim()
  if (!candidate) return FALLBACK_TZ
  try {
    // Validate IANA timezone
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return FALLBACK_TZ
  }
}

function formatEpisodeList(numbers: number[]): string {
  const nums = Array.from(new Set(numbers.filter((n) => Number.isInteger(n) && n >= 1))).sort((a, b) => a - b)
  if (nums.length === 0) return ""
  if (nums.length === 1) return String(nums[0])
  if (nums.length === 2) return `${nums[0]} & ${nums[1]}`

  const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1)
  if (contiguous) return `${nums[0]}-${nums[nums.length - 1]}`
  return nums.join(", ")
}

function buildReleaseMessage(params: {
  title: string
  seasonNumber: number
  kind: string | null
  episodeNumbers: any
}): string {
  const { title, seasonNumber, kind, episodeNumbers } = params
  const nums = Array.isArray(episodeNumbers)
    ? episodeNumbers.filter((n) => Number.isInteger(n) && n >= 1).sort((a: number, b: number) => a - b)
    : []

  if (kind === "episodes" && nums.length > 0) {
    if (nums.length === 1) {
      return `NEW RELEASE! Episode ${nums[0]} for Season ${seasonNumber} of ${title} is out today!`
    }
    const list = formatEpisodeList(nums)
    return `NEW RELEASE! Episodes ${list} for Season ${seasonNumber} of ${title} are out today!`
  }

  // full_season, unknown, or missing/undetermined episode details -> fallback A (season-level)
  return `NEW RELEASE! ${title} Season ${seasonNumber} is out today!`
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) {
    return Response.json({ error: "VAPID not configured" }, { status: 500 })
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)

  const admin = createAdminClient()
  const now = new Date()

  // Candidate shows: recent release recorded (in-window logic maintained by refresh/persist).
  const { data: shows } = await admin
    .from("tv_shows")
    .select("id, recent_release_season_number, recent_release_date, recent_release_kind, recent_release_episode_numbers, media:media!inner(id, title)")
    .not("recent_release_date", "is", null)
    .not("recent_release_season_number", "is", null)

  if (!shows?.length) return Response.json({ sent: 0, checked: 0 })

  let sent = 0
  let checked = 0

  for (const show of shows as any[]) {
    const media = Array.isArray(show.media) ? show.media[0] : show.media
    const mediaId = (show.id ?? media?.id) as string | undefined
    const seasonNumber = show.recent_release_season_number as number | null
    const releaseDate = show.recent_release_date as string | null
    const title = (media?.title as string | undefined) ?? "This show"
    if (!mediaId || seasonNumber == null || !releaseDate) continue

    checked++

    // Users who have this TV show on their Upcoming/Renewed eligible list.
    const { data: ratingRows } = await admin
      .from("ratings")
      .select("user_id, media:media!inner(id, media_type, tv_shows!inner(status))")
      .eq("media_id", mediaId)
      .eq("media.media_type", "tv")
      .eq("media.tv_shows.status", "Returning Series")

    if (!ratingRows?.length) continue

    const userIds = Array.from(new Set((ratingRows as any[]).map((r) => r.user_id).filter(Boolean))) as string[]
    if (userIds.length === 0) continue

    const { data: settingsRows } = await admin
      .from("notification_settings")
      .select("user_id, upcoming_release_notifications, timezone")
      .in("user_id", userIds)

    const settingsByUser = new Map<string, any>()
    for (const s of (settingsRows || []) as any[]) settingsByUser.set(s.user_id, s)

    const body = buildReleaseMessage({
      title,
      seasonNumber,
      kind: show.recent_release_kind ?? null,
      episodeNumbers: show.recent_release_episode_numbers ?? null,
    })
    const payload = JSON.stringify({
      title: "New Release",
      body,
      url: "/upcoming",
      icon: "/icons/notification-icon-192.png",
      badge: "/icons/notification-badge.png",
    })

    for (const userId of userIds) {
      const settings = settingsByUser.get(userId)
      // Default to enabled if no row; respect explicit opt-out.
      if (settings && settings.upcoming_release_notifications === false) continue

      const tz = normalizeTz(settings?.timezone ?? null)
      let parts
      try {
        parts = localParts(now, tz)
      } catch {
        try {
          parts = localParts(now, FALLBACK_TZ)
        } catch {
          continue
        }
      }

      // Only on the actual release day, around local noon or later (once-per-day enforced by dedupe).
      if (parts.date !== releaseDate) continue
      if (parts.minutes < 12 * 60) continue

      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userId)
        .eq("active", true)

      if (!subs?.length) continue

      for (const sub of subs as any[]) {
        const { error: claimErr } = await admin
          .from("release_notification_deliveries")
          .insert({
            user_id: userId,
            media_id: mediaId,
            season_number: seasonNumber,
            release_date: releaseDate,
            subscription_id: sub.id,
          })

        if (claimErr?.code === "23505") continue // already delivered/claimed

        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 21600, urgency: "normal", topic: "upcoming-release" }
          )
          sent++
        } catch (err: any) {
          const status = err?.statusCode
          if ([404, 410, 400, 413].includes(status)) {
            await admin.from("push_subscriptions").update({ active: false }).eq("id", sub.id)
          }
          // Release claim on failure so it can be retried.
          await admin
            .from("release_notification_deliveries")
            .delete()
            .eq("user_id", userId)
            .eq("media_id", mediaId)
            .eq("season_number", seasonNumber)
            .eq("release_date", releaseDate)
            .eq("subscription_id", sub.id)
        }
      }
    }
  }

  return Response.json({ sent, checked })
}
