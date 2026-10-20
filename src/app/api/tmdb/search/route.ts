import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN
const TMDB_BASE = "https://api.themoviedb.org/3"

interface TmdbSearchResult {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: string
  media_type: string
  overview: string
}

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

    const results: TmdbSearchResult[] = (data.results || []).slice(0, 10).map((item: any) => ({
      tmdb_id: item.id as number,
      title: type === "tv" ? item.name : item.title,
      poster_path: item.poster_path,
      year: (item.release_date || item.first_air_date || "").slice(0, 4),
      media_type: type,
      overview: item.overview,
    }))

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const ratedByTmdbId = new Map<number, string>()
    if (user && results.length > 0) {
      const { data: mediaRows } = await supabase
        .from("media")
        .select("id, tmdb_id")
        .eq("media_type", type)
        .in("tmdb_id", results.map((r) => r.tmdb_id))

      const tmdbIdByMediaId = new Map<string, number>()
      for (const row of mediaRows ?? []) {
        tmdbIdByMediaId.set(row.id, row.tmdb_id)
      }

      if (tmdbIdByMediaId.size > 0) {
        const { data: ratingRows } = await supabase
          .from("ratings")
          .select("id, media_id")
          .eq("user_id", user.id)
          .in("media_id", [...tmdbIdByMediaId.keys()])

        for (const row of ratingRows ?? []) {
          const tmdbId = tmdbIdByMediaId.get(row.media_id)
          if (tmdbId != null) ratedByTmdbId.set(tmdbId, row.id)
        }
      }
    }

    return Response.json({
      results: results.map((r) => ({
        ...r,
        already_rated: ratedByTmdbId.has(r.tmdb_id),
        entry_id: ratedByTmdbId.get(r.tmdb_id) ?? null,
      })),
    })
  } catch {
    return Response.json({ error: "Failed to fetch from TMDB" }, { status: 500 })
  }
}
