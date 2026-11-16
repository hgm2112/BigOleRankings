import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getWatchlistEligibilityForMediaId, reasonLabel } from "@/lib/watchlist"
import { TitleDetailClient } from "./title-detail-client"

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN
const TMDB_BASE = "https://api.themoviedb.org/3"

interface TMDBSeason {
  season_number: number
  name: string
  air_year: number | null
  air_date: string | null
  episode_count: number
}

interface TMDBTitleDetails {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: string
  media_type: "movie" | "tv"
  overview: string
  genres: string[]
  runtime: number | null
  episode_runtime: number | null
  seasons: TMDBSeason[] | null
  status: string | null
  next_air_date: string | null
  network: string | null
}

async function fetchTitleDetails(type: "movie" | "tv", tmdbId: number): Promise<TMDBTitleDetails | null> {
  if (!TMDB_ACCESS_TOKEN) return null
  const endpoint = type === "tv" ? `tv/${tmdbId}` : `movie/${tmdbId}`
  const url = `${TMDB_BASE}/${endpoint}?language=en-US`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}` },
      next: { revalidate: 3600 },
    })
    const item = await res.json()
    if (!res.ok) return null

    const isTv = type === "tv"
    const runtime = isTv
      ? (item.episode_run_time?.[0] || 0) * (item.number_of_episodes || 0)
      : (item.runtime ?? null)
    const seasons = isTv
      ? (item.seasons || [])
          .filter((s: any) => s.season_number >= 1)
          .map((s: any) => ({
            season_number: s.season_number as number,
            name: (s.name ?? `Season ${s.season_number}`) as string,
            air_year: s.air_date ? Number(String(s.air_date).slice(0, 4)) : null,
            air_date: s.air_date && /^\d{4}-\d{2}-\d{2}$/.test(s.air_date) ? s.air_date : null,
            episode_count: (s.episode_count ?? 0) as number,
          }))
      : null

    return {
      tmdb_id: item.id,
      title: isTv ? item.name : item.title,
      poster_path: item.poster_path ?? null,
      year: String(item.release_date || item.first_air_date || "").slice(0, 4),
      media_type: type,
      overview: item.overview ?? "",
      genres: (item.genres || []).map((g: any) => g.name as string),
      runtime,
      episode_runtime: isTv ? (item.episode_run_time?.[0] || null) : null,
      seasons,
      status: isTv ? (item.status ?? null) : null,
      next_air_date: isTv ? (item.next_episode_to_air?.air_date ?? null) : null,
      network: isTv ? (item.networks?.[0]?.name ?? null) : null,
    }
  } catch {
    return null
  }
}

export default async function TitlePage({
  params,
}: {
  params: Promise<{ type: string; tmdbId: string }>
}) {
  const { type, tmdbId } = await params
  if (type !== "movie" && type !== "tv") notFound()
  const idNum = Number(tmdbId)
  if (!Number.isInteger(idNum) || idNum <= 0) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // If the user already rated this title, send them to their entry (full detail view).
  const { data: mediaRow } = await supabase
    .from("media")
    .select("id")
    .eq("tmdb_id", idNum)
    .eq("media_type", type)
    .maybeSingle()

  let initialWatchlist = { eligible: true, onWatchlist: false, reason: null as string | null }
  let hasActiveWatching = false
  if (mediaRow?.id) {
    const { data: ratingRow } = await supabase
      .from("ratings")
      .select("id")
      .eq("user_id", user.id)
      .eq("media_id", mediaRow.id)
      .maybeSingle()
    if (ratingRow?.id) redirect(`/entries/${ratingRow.id}`)

    const eligibility = await getWatchlistEligibilityForMediaId(supabase, user.id, mediaRow.id)
    initialWatchlist = {
      eligible: eligibility.eligible,
      onWatchlist: eligibility.onWatchlist,
      reason: eligibility.reason ? reasonLabel(eligibility.reason) : null,
    }

    const { data: active } = await supabase
      .from("watch_periods")
      .select("id")
      .eq("user_id", user.id)
      .eq("media_id", mediaRow.id)
      .eq("status", "currently_watching")
      .limit(1)
    hasActiveWatching = (active?.length ?? 0) > 0
  }

  const details = await fetchTitleDetails(type as "movie" | "tv", idNum)
  if (!details) notFound()

  return (
    <TitleDetailClient
      details={details}
      initialWatchlist={initialWatchlist}
      hasActiveWatching={hasActiveWatching}
    />
  )
}
