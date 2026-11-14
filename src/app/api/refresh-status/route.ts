import { NextRequest } from "next/server"
import { after } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { fetchAndPersistShowReleaseInfo } from "@/lib/upcoming-releases"

export const maxDuration = 60

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DELAY_MS = 250

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function refreshStatuses() {
  if (!TMDB_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("refresh-status: missing env vars")
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: shows } = await supabase
    .from("tv_shows")
    .select("id, status, media:media(tmdb_id)")

  if (!shows || shows.length === 0) return

  // Determine which shows already have seasons stored so we know which ones need
  // a season refresh even if their status is terminal (Ended/Canceled).
  const showIds = shows.map((s) => s.id)
  const { data: seasonRows } = await supabase
    .from("seasons")
    .select("media_id")
    .in("media_id", showIds)

  const withSeasons = new Set((seasonRows || []).map((s) => s.media_id))

  let updated = 0
  let first = true
  for (const show of shows) {
    const tmdbId = (show.media as any)?.tmdb_id
    if (!tmdbId) continue

    const needsRefresh =
      show.status == null ||
      show.status === "Returning Series" ||
      !withSeasons.has(show.id)

    if (!needsRefresh) continue

    if (!first) await delay(DELAY_MS)
    first = false

    const result = await fetchAndPersistShowReleaseInfo(supabase, show.id, tmdbId, TMDB_TOKEN)
    if (result.ok) updated++
    else console.error(`refresh-status: failed for tv/${tmdbId} (${show.id})`, result.error)
  }

  console.log(`refresh-status: checked ${shows.length}, updated ${updated}`)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  after(() => refreshStatuses())

  return Response.json({ success: true })
}
