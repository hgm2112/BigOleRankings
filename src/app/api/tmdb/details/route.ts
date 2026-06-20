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

    const result = {
      tmdb_id: item.id,
      title: type === "tv" ? item.name : item.title,
      poster_path: item.poster_path,
      year: (item.release_date || item.first_air_date || "").slice(0, 4),
      media_type: type,
      overview: item.overview,
    }

    return Response.json(result)
  } catch {
    return Response.json({ error: "Failed to fetch from TMDB" }, { status: 500 })
  }
}
