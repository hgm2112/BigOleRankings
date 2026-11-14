import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import {
  backfillMissingTvSeasonCounts,
  ensureTvSeasons,
  getWatchlistEligibilityForMediaId,
  normalizeWatchlistRows,
  WATCHLIST_SELECT,
} from "@/lib/watchlist"

function getServiceClient() {
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceUrl || !serviceKey) return null
  return createClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function ensureMedia(service: any, body: any): Promise<{ mediaId: string; mediaType: "movie" | "tv"; tmdbId: number } | { error: string; status: number }> {
  const mediaType = body.media_type
  if (mediaType !== "movie" && mediaType !== "tv") {
    return { error: "Invalid media_type", status: 400 }
  }
  if (typeof body.tmdb_id !== "number") return { error: "tmdb_id required", status: 400 }
  if (typeof body.title !== "string" || !body.title) return { error: "title required", status: 400 }

  const { data: mediaRow, error: mediaError } = await service
    .from("media")
    .upsert(
      {
        tmdb_id: body.tmdb_id,
        media_type: mediaType,
        title: body.title,
        poster_path: body.poster_path ?? null,
        year: body.year ?? null,
        genres: Array.isArray(body.genres) ? body.genres : null,
      },
      { onConflict: "tmdb_id,media_type" }
    )
    .select("id")
    .single()

  if (mediaError || !mediaRow) {
    return { error: mediaError?.message ?? "Failed to save media", status: 500 }
  }

  const mediaId = mediaRow.id as string

  if (mediaType === "movie") {
    const { error } = await service
      .from("movies")
      .upsert({ id: mediaId, runtime: body.runtime ?? null }, { onConflict: "id" })
    if (error) return { error: error.message, status: 500 }
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
    if (tvError) return { error: tvError.message, status: 500 }
    await ensureTvSeasons(service, body.tmdb_id, mediaId)
  }

  return { mediaId, mediaType, tmdbId: body.tmdb_id }
}

export async function GET() {
  const supabase = await createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 })

  const { data, error } = await supabase
    .from("watchlist")
    .select(WATCHLIST_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  let rows = data ?? []
  const service = getServiceClient()
  const { changed } = await backfillMissingTvSeasonCounts(service, rows)
  if (changed) {
    const { data: refreshed } = await supabase
      .from("watchlist")
      .select(WATCHLIST_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    if (refreshed) rows = refreshed
  }

  return Response.json({ items: normalizeWatchlistRows(rows) })
}

export async function POST(request: NextRequest) {
  const supabase = await createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  let mediaId: string | null = typeof body.media_id === "string" ? body.media_id : null
  let tmdbId: number | null = typeof body.tmdb_id === "number" ? body.tmdb_id : null
  let mediaType: "movie" | "tv" | null = body.media_type === "movie" || body.media_type === "tv" ? body.media_type : null

  const service = getServiceClient()

  if (!mediaId) {
    if (!service) {
      return Response.json({ error: "Server misconfigured" }, { status: 500 })
    }
    const ensured = await ensureMedia(service, body)
    if ("error" in ensured) return Response.json({ error: ensured.error }, { status: ensured.status })
    mediaId = ensured.mediaId
    tmdbId = ensured.tmdbId
    mediaType = ensured.mediaType
  } else {
    const { data: mediaRow, error: mediaErr } = await supabase
      .from("media")
      .select("id, tmdb_id, media_type")
      .eq("id", mediaId)
      .maybeSingle()
    if (mediaErr || !mediaRow) {
      return Response.json({ error: "Media not found" }, { status: 404 })
    }
    tmdbId = mediaRow.tmdb_id as number
    mediaType = mediaRow.media_type as "movie" | "tv"
    if (service && mediaType === "tv" && typeof tmdbId === "number") {
      await ensureTvSeasons(service, tmdbId, mediaId)
    }
  }

  const eligibility = await getWatchlistEligibilityForMediaId(supabase, user.id, mediaId)
  if (!eligibility.eligible) {
    return Response.json(
      { error: "Not eligible for watchlist", reason: eligibility.reason },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from("watchlist")
    .insert({ user_id: user.id, media_id: mediaId })
    .select(WATCHLIST_SELECT)
    .single()

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "Already on watchlist", reason: "already_on_watchlist" }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, item: normalizeWatchlistRows([data])[0] ?? null })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 })

  const body = await request.json().catch(() => ({} as any))
  const mediaId = typeof body?.media_id === "string" ? body.media_id : null
  const id = typeof body?.id === "string" ? body.id : null

  if (!mediaId && !id) {
    return Response.json({ error: "media_id or id required" }, { status: 400 })
  }

  let query = supabase.from("watchlist").delete().eq("user_id", user.id)
  if (id) query = query.eq("id", id)
  else if (mediaId) query = query.eq("media_id", mediaId)

  const { error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
