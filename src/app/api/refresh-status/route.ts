import { NextRequest } from "next/server"
import { after } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 60

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TMDB_BASE = "https://api.themoviedb.org/3"
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
  for (const show of shows) {
    const tmdbId = (show.media as any)?.tmdb_id
    if (!tmdbId) continue

    const needsRefresh =
      show.status == null ||
      show.status === "Returning Series" ||
      !withSeasons.has(show.id)

    if (!needsRefresh) continue

    await delay(DELAY_MS)
    try {
      const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?language=en-US`, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
      })
      if (!res.ok) continue
      const item = await res.json()

      const status: string | null = item.status ?? null

      const { error: tvError } = await supabase
        .from("tv_shows")
        .update({
          status,
          next_air_date: item.next_episode_to_air?.air_date ?? null,
          network: item.networks?.[0]?.name ?? null,
        })
        .eq("id", show.id)

      if (tvError) {
        console.error(`refresh-status: failed to update tv_shows/${show.id}`, tvError)
        continue
      }

      const seasons = (item.seasons || [])
        .filter((s: any) => s.season_number >= 1)
        .map((s: any) => ({
          media_id: show.id,
          season_number: s.season_number,
          name: s.name,
          air_year: s.air_date ? Number(s.air_date.slice(0, 4)) : null,
          episode_count: s.episode_count ?? 0,
        }))

      if (seasons.length > 0) {
        const { error: seasonsError } = await supabase.from("seasons").upsert(seasons, {
          onConflict: "media_id,season_number",
        })
        if (seasonsError) {
          console.error(`refresh-status: failed to upsert seasons for ${show.id}`, seasonsError)
          continue
        }
      }

      updated++
    } catch (error) {
      console.error(`refresh-status: failed for tv/${tmdbId}`, error)
    }
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
