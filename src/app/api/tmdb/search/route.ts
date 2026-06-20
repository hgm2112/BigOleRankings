import { NextRequest } from "next/server"

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN
const TMDB_BASE = "https://api.themoviedb.org/3"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")
  const type = request.nextUrl.searchParams.get("type") || "movie"

  if (!query) {
    return Response.json({ error: "Query parameter is required" }, { status: 400 })
  }

  if (!TMDB_ACCESS_TOKEN) {
    return Response.json({ error: "TMDB access token not configured" }, { status: 500 })
  }

  const endpoint = type === "tv" ? "search/tv" : "search/movie"
  const url = `${TMDB_BASE}/${endpoint}?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}` },
    })
    const data = await res.json()

    if (!res.ok) {
      return Response.json({ error: data.status_message || "TMDB request failed" }, { status: res.status })
    }

    const results = (data.results || []).slice(0, 10).map((item: any) => ({
      tmdb_id: item.id,
      title: type === "tv" ? item.name : item.title,
      poster_path: item.poster_path,
      year: (item.release_date || item.first_air_date || "").slice(0, 4),
      media_type: type,
      overview: item.overview,
    }))

    return Response.json({ results })
  } catch {
    return Response.json({ error: "Failed to fetch from TMDB" }, { status: 500 })
  }
}
