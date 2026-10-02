import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createUserClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceUrl || !serviceKey) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const service = createClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Upsert the shared media row (dedupes by tmdb_id + media_type)
  const { data: mediaRow, error: mediaError } = await service
    .from("media")
    .upsert(
      {
        tmdb_id: body.tmdb_id,
        media_type: body.media_type,
        title: body.title,
        poster_path: body.poster_path,
        year: body.year,
        genres: Array.isArray(body.genres) ? body.genres : null,
      },
      { onConflict: "tmdb_id,media_type" }
    )
    .select("id")
    .single()

  if (mediaError || !mediaRow) {
    return Response.json({ error: mediaError?.message ?? "Failed to save media" }, { status: 500 })
  }

  const mediaId = mediaRow.id

  // 2. Upsert the type-specific extension + seasons
  if (body.media_type === "movie") {
    const { error: movieError } = await service
      .from("movies")
      .upsert({ id: mediaId, runtime: body.runtime ?? null }, { onConflict: "id" })

    if (movieError) {
      return Response.json({ error: movieError.message }, { status: 500 })
    }
  } else {
    const { error: tvError } = await service
      .from("tv_shows")
      .upsert(
        {
          id: mediaId,
          status: body.status ?? null,
          next_air_date: body.next_air_date ?? null,
          network: body.network ?? null,
        },
        { onConflict: "id" }
      )

    if (tvError) {
      return Response.json({ error: tvError.message }, { status: 500 })
    }

    const seasons = Array.isArray(body.seasons) ? body.seasons : []
    if (seasons.length > 0) {
      const { error: seasonsError } = await service.from("seasons").upsert(
        seasons.map((s: any) => ({
          media_id: mediaId,
          season_number: s.season_number,
          name: s.name ?? null,
          air_year: s.air_year ?? null,
          episode_count: s.episode_count ?? 0,
        })),
        { onConflict: "media_id,season_number" }
      )

      if (seasonsError) {
        return Response.json({ error: seasonsError.message }, { status: 500 })
      }
    }
  }

  // 3. Insert the user's rating
  const { error } = await supabase.from("ratings").insert({
    user_id: user.id,
    media_id: mediaId,
    gut_rating: body.gut_rating,
    gut_rated_at: new Date().toISOString(),
    weight: body.weight ?? 0,
    notes: body.notes || "",
  })

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "You've already rated this title!" }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  // 4. Insert any season ratings staged with the entry (requires the seasons rows from step 2)
  interface SeasonRatingInput {
    season_number?: number
    rating?: number | null
    dnf?: boolean
  }
  const rawSeasonRatings: (SeasonRatingInput | null)[] = Array.isArray(body.season_ratings)
    ? body.season_ratings
    : []
  const seasonRatingRows = rawSeasonRatings.flatMap((sr) => {
    if (sr == null || typeof sr.season_number !== "number" || !Number.isInteger(sr.season_number)) return []
    const ratingOk = typeof sr.rating === "number" && Number.isInteger(sr.rating) && sr.rating >= 1 && sr.rating <= 10
    const dnfOk = sr.dnf === true
    if (!ratingOk && !dnfOk) return []
    return [{
      user_id: user.id,
      media_id: mediaId,
      season_number: sr.season_number,
      rating: ratingOk && sr.rating != null ? sr.rating : null,
      dnf: dnfOk,
    }]
  })

  if (body.media_type === "tv" && seasonRatingRows.length > 0) {
    const { error: seasonRatingsError } = await supabase
      .from("season_ratings")
      .upsert(seasonRatingRows, { onConflict: "user_id,media_id,season_number" })

    if (seasonRatingsError) {
      return Response.json(
        { error: `Rating saved, but season ratings failed: ${seasonRatingsError.message}` },
        { status: 500 }
      )
    }
  }

  return Response.json({ success: true })
}
