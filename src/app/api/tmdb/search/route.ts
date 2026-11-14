import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getWatchlistEligibilityForMediaIds } from "@/lib/watchlist"

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN
const TMDB_BASE = "https://api.themoviedb.org/3"

interface TmdbSearchResult {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: string
  media_type: "movie" | "tv"
  overview: string
}

async function searchTmdb(query: string, type: "movie" | "tv"): Promise<TmdbSearchResult[]> {
  const endpoint = type === "tv" ? "search/tv" : "search/movie"
  const url = `${TMDB_BASE}/${endpoint}?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}` },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.status_message || "TMDB request failed")
  }
  return (data.results || []).slice(0, 10).map((item: any) => ({
    tmdb_id: item.id as number,
    title: (type === "tv" ? item.name : item.title) as string,
    poster_path: (item.poster_path ?? null) as string | null,
    year: String((item.release_date || item.first_air_date || "")).slice(0, 4),
    media_type: type,
    overview: (item.overview || "") as string,
  }))
}

async function fetchTvSeasonCount(tmdbId: number): Promise<number | null> {
  if (!TMDB_ACCESS_TOKEN) return null
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?language=en-US`, {
      headers: { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}` },
    })
    if (!res.ok) return null
    const item = await res.json()
    const count = (item.seasons || []).filter((s: any) => typeof s?.season_number === "number" && s.season_number >= 1).length
    return count > 0 ? count : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")
  const typeParam = request.nextUrl.searchParams.get("type") || "movie"

  if (!query) {
    return Response.json({ error: "Query parameter is required" }, { status: 400 })
  }

  if (!TMDB_ACCESS_TOKEN) {
    return Response.json({ error: "TMDB access token not configured" }, { status: 500 })
  }

  try {
    let results: TmdbSearchResult[] = []
    if (typeParam === "all") {
      const [movies, tv] = await Promise.all([searchTmdb(query, "movie"), searchTmdb(query, "tv")])
      const merged: TmdbSearchResult[] = []
      const max = Math.max(movies.length, tv.length)
      for (let i = 0; i < max; i++) {
        if (movies[i]) merged.push(movies[i])
        if (tv[i]) merged.push(tv[i])
      }
      results = merged.slice(0, 20)
    } else if (typeParam === "tv" || typeParam === "movie") {
      results = await searchTmdb(query, typeParam)
    } else {
      results = await searchTmdb(query, "movie")
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const ratedByKey = new Map<string, string>() // `${media_type}:${tmdb_id}` -> entry_id
    const eligibilityByKey = new Map<string, { eligible: boolean; on_watchlist: boolean; reason: string | null }>()
    const seasonCountByKey = new Map<string, number>()

    if (user && results.length > 0) {
      const movieIds = results.filter((r) => r.media_type === "movie").map((r) => r.tmdb_id)
      const tvIds = results.filter((r) => r.media_type === "tv").map((r) => r.tmdb_id)

      const [movieMediaRes, tvMediaRes] = await Promise.all([
        movieIds.length > 0
          ? supabase.from("media").select("id, tmdb_id, media_type").eq("media_type", "movie").in("tmdb_id", movieIds)
          : Promise.resolve({ data: [] as any[] }),
        tvIds.length > 0
          ? supabase.from("media").select("id, tmdb_id, media_type, seasons(season_number)").eq("media_type", "tv").in("tmdb_id", tvIds)
          : Promise.resolve({ data: [] as any[] }),
      ])

      const mediaRows = [...(movieMediaRes.data ?? []), ...(tvMediaRes.data ?? [])] as Array<{ id: string; tmdb_id: number; media_type: string; seasons?: Array<{ season_number?: number }> }>
      const tmdbIdByMediaId = new Map<string, { tmdb_id: number; media_type: string }>()
      const mediaIdByKey = new Map<string, string>()
      for (const row of mediaRows) {
        tmdbIdByMediaId.set(row.id, { tmdb_id: row.tmdb_id, media_type: row.media_type })
        const key = `${row.media_type}:${row.tmdb_id}`
        mediaIdByKey.set(key, row.id)
        if (row.media_type === "tv") {
          const count = (row.seasons ?? []).filter((s) => typeof s?.season_number === "number" && s.season_number >= 1).length
          if (count > 0) seasonCountByKey.set(key, count)
        }
      }

      if (tmdbIdByMediaId.size > 0) {
        const mediaIds = [...tmdbIdByMediaId.keys()]
        const [ratingRowsRes, eligibilityMap] = await Promise.all([
          supabase.from("ratings").select("id, media_id").eq("user_id", user.id).in("media_id", mediaIds),
          getWatchlistEligibilityForMediaIds(supabase, user.id, mediaIds),
        ])

        for (const row of ratingRowsRes.data ?? []) {
          const info = tmdbIdByMediaId.get((row as any).media_id)
          if (info) ratedByKey.set(`${info.media_type}:${info.tmdb_id}`, (row as any).id)
        }

        for (const [key, mediaId] of mediaIdByKey.entries()) {
          const e = eligibilityMap.get(mediaId)
          if (e) {
            eligibilityByKey.set(key, {
              eligible: e.eligible,
              on_watchlist: e.onWatchlist,
              reason: e.reason,
            })
          }
        }
      }
    }

    // For TV results without a known season count (not in DB or no stored seasons),
    // fetch TMDB details so season counts show up in watchlist search results.
    const missingTv = results.filter((r) => r.media_type === "tv" && !seasonCountByKey.has(`tv:${r.tmdb_id}`))
    if (missingTv.length > 0) {
      const fetched = await Promise.all(
        missingTv.map(async (r) => ({ key: `tv:${r.tmdb_id}`, count: await fetchTvSeasonCount(r.tmdb_id) }))
      )
      for (const { key, count } of fetched) {
        if (typeof count === "number" && count > 0) seasonCountByKey.set(key, count)
      }
    }

    return Response.json({
      results: results.map((r) => {
        const key = `${r.media_type}:${r.tmdb_id}`
        const eligibility = eligibilityByKey.get(key)
        return {
          ...r,
          already_rated: ratedByKey.has(key),
          entry_id: ratedByKey.get(key) ?? null,
          on_watchlist: eligibility?.on_watchlist ?? false,
          eligible_for_watchlist: eligibility ? eligibility.eligible : true,
          ineligible_reason: eligibility ? eligibility.reason : null,
          season_count: seasonCountByKey.get(key) ?? null,
        }
      }),
    })
  } catch {
    return Response.json({ error: "Failed to fetch from TMDB" }, { status: 500 })
  }
}
