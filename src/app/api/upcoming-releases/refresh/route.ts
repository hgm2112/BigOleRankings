import { createClient } from "@/lib/supabase/server"
import {
  createServiceSupabaseClient,
  delay,
  fetchAndPersistShowReleaseInfo,
  getEligibleUpcomingShowsForUser,
  TMDB_DELAY_MS,
  type UpcomingShow,
} from "@/lib/upcoming-releases"

export const maxDuration = 60

interface Failure {
  mediaId: string
  title?: string | null
  error?: string
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const token = process.env.TMDB_ACCESS_TOKEN
  if (!token) {
    return Response.json({ error: "TMDB access token not configured" }, { status: 500 })
  }

  const service = createServiceSupabaseClient()
  if (!service) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const eligible = await getEligibleUpcomingShowsForUser(supabase, user.id)
  const total = eligible.length
  const failures: Failure[] = []
  let updated = 0

  const seen = new Set<string>()
  for (let i = 0; i < eligible.length; i++) {
    const show = eligible[i]
    if (seen.has(show.mediaId)) continue
    seen.add(show.mediaId)

    if (i > 0) await delay(TMDB_DELAY_MS)

    const result = await fetchAndPersistShowReleaseInfo(service, show.mediaId, show.tmdbId, token)
    if (result.ok) {
      updated++
    } else {
      failures.push({ mediaId: show.mediaId, title: show.title, error: result.error || "Failed to update" })
    }
  }

  // Return refreshed view from DB (no TMDB calls).
  const refreshedShows: UpcomingShow[] = await getEligibleUpcomingShowsForUser(supabase, user.id)

  return Response.json({
    total,
    updated,
    failed: failures.length,
    failures,
    shows: refreshedShows,
  })
}
