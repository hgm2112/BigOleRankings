import { NextRequest } from "next/server"

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN
const TMDB_BASE = "https://api.themoviedb.org/3"

export async function GET(request: NextRequest) {
  const tmdbId = request.nextUrl.searchParams.get("id")
  const type = request.nextUrl.searchParams.get("type") || "movie"

  if (!tmdbId) {
    return Response.json({ error: "id parameter is required" }, { status: 400 })
  }

  if (!TMDB_ACCESS_TOKEN) {
    return Response.json({ error: "TMDB access token not configured" }, { status: 500 })
  }

  const endpoint = type === "tv" ? `tv/${tmdbId}` : `movie/${tmdbId}`
  const url = `${TMDB_BASE}/${endpoint}?language=en-US`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}` },
    })
    const item = await res.json()

    if (!res.ok) {
      return Response.json({ error: item.status_message || "TMDB request failed" }, { status: res.status })
    }

    const isTv = type === "tv"

    const runtime = isTv
      ? (item.episode_run_time?.[0] || 0) * (item.number_of_episodes || 0)
      : item.runtime ?? null

    const seasons = isTv
      ? (item.seasons || [])
          .filter((s: any) => s.season_number >= 1)
          .map((s: any) => ({
            season_number: s.season_number,
            name: s.name,
            air_year: s.air_date ? Number(s.air_date.slice(0, 4)) : null,
            air_date: s.air_date && /^\d{4}-\d{2}-\d{2}$/.test(s.air_date) ? s.air_date : null,
            episode_count: s.episode_count ?? 0,
          }))
      : null

    const nextEpisode = isTv ? item.next_episode_to_air ?? null : null
    let upcomingSeasonNumber: number | null = null
    let upcomingReleaseDate: string | null = null
    if (isTv) {
      const today = new Date().toISOString().slice(0, 10)
      if (
        nextEpisode &&
        typeof nextEpisode.season_number === "number" &&
        nextEpisode.season_number >= 1 &&
        typeof nextEpisode.air_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(nextEpisode.air_date) &&
        nextEpisode.air_date > today
      ) {
        if (nextEpisode.episode_number === 1) {
          upcomingSeasonNumber = nextEpisode.season_number
          upcomingReleaseDate = nextEpisode.air_date
        }
      }
      if (upcomingReleaseDate == null && Array.isArray(seasons)) {
        const candidates = seasons
          .filter((s: any) => s.air_date && s.air_date > today)
          .sort((a: any, b: any) => (a.air_date === b.air_date ? a.season_number - b.season_number : a.air_date < b.air_date ? -1 : 1))
        if (candidates.length > 0) {
          upcomingSeasonNumber = candidates[0].season_number
          upcomingReleaseDate = candidates[0].air_date
        }
      }
    }

    const result = {
      tmdb_id: item.id,
      title: isTv ? item.name : item.title,
      poster_path: item.poster_path,
      year: (item.release_date || item.first_air_date || "").slice(0, 4),
      media_type: type,
      overview: item.overview,
      genres: (item.genres || []).map((g: any) => g.name),
      runtime,
      episode_runtime: isTv ? (item.episode_run_time?.[0] || null) : null,
      seasons,
      status: isTv ? item.status ?? null : null,
      next_air_date: isTv ? item.next_episode_to_air?.air_date ?? null : null,
      network: isTv ? (item.networks?.[0]?.name ?? null) : null,
      next_episode_to_air: isTv && nextEpisode ? {
        season_number: nextEpisode.season_number ?? null,
        episode_number: nextEpisode.episode_number ?? null,
        air_date: nextEpisode.air_date ?? null,
      } : null,
      upcoming_season_number: upcomingSeasonNumber,
      upcoming_release_date: upcomingReleaseDate,
      // Minimal raw TV payload for server-side persistence (avoids duplicate TMDB fetch on detail open).
      tmdb_tv: isTv ? {
        id: item.id,
        status: item.status ?? null,
        next_air_date: item.next_episode_to_air?.air_date ?? null,
        next_episode_to_air: item.next_episode_to_air ?? null,
        networks: item.networks ?? [],
        seasons: item.seasons ?? [],
      } : null,
    }

    return Response.json(result)
  } catch {
    return Response.json({ error: "Failed to fetch from TMDB" }, { status: 500 })
  }
}
