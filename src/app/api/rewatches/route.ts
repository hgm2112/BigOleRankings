import { NextRequest } from "next/server"
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

type Body = {
  media_id?: unknown
  tmdb_id?: unknown
  media_type?: unknown
  title?: unknown
  poster_path?: unknown
  year?: unknown
  season_number?: unknown // null/undefined = whole movie or whole TV show
  delta?: unknown // +1 or -1
}

function jsonError(error: string, status = 400) {
  return Response.json({ error }, { status })
}

function isValidSeasonNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1
}

async function ensureMedia(service: SupabaseClient, body: Body): Promise<{ mediaId: string } | { error: string; status: number }> {
  const mediaType = body.media_type
  if (mediaType !== "movie" && mediaType !== "tv") return { error: "Invalid media_type", status: 400 }
  if (typeof body.tmdb_id !== "number") return { error: "tmdb_id required", status: 400 }
  if (typeof body.title !== "string" || !body.title) return { error: "title required", status: 400 }

  const { data: mediaRow, error: mediaError } = await service
    .from("media")
    .upsert(
      {
        tmdb_id: body.tmdb_id,
        media_type: mediaType,
        title: body.title,
        poster_path: typeof body.poster_path === "string" ? body.poster_path : null,
        year: typeof body.year === "number" ? body.year : null,
      },
      { onConflict: "tmdb_id,media_type" }
    )
    .select("id")
    .single()

  if (mediaError || !mediaRow) return { error: mediaError?.message ?? "Failed to save media", status: 500 }
  const mediaId = mediaRow.id as string

  if (mediaType === "movie") {
    const { error } = await service.from("movies").upsert({ id: mediaId }, { onConflict: "id" })
    if (error) return { error: error.message, status: 500 }
  } else {
    const { error } = await service.from("tv_shows").upsert({ id: mediaId }, { onConflict: "id" })
    if (error) return { error: error.message, status: 500 }
  }

  return { mediaId }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError("Not authenticated", 401)

  let body: Body
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON")
  }

  const rawSeason = body.season_number
  let seasonNumber: number | null = null
  if (rawSeason !== null && rawSeason !== undefined) {
    const n = typeof rawSeason === "number" ? rawSeason : Number(rawSeason)
    if (!isValidSeasonNumber(n)) return jsonError("season_number must be a whole number >= 1, or null")
    seasonNumber = n
  }

  const delta = body.delta
  if (delta !== 1 && delta !== -1) return jsonError("delta must be 1 or -1")

  let mediaId = typeof body.media_id === "string" ? body.media_id : null

  // Allow title pages to pass TMDB info when media row doesn't exist yet.
  if (!mediaId) {
    if (typeof body.tmdb_id === "number" && typeof body.media_type === "string") {
      const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!serviceUrl || !serviceKey) return jsonError("Server misconfigured", 500)
      const service = createServiceClient(serviceUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const ensured = await ensureMedia(service, body)
      if ("error" in ensured) return jsonError(ensured.error, ensured.status)
      mediaId = ensured.mediaId
    } else {
      return jsonError("media_id or tmdb_id+media_type+title required")
    }
  }

  // Confirm media exists and season is valid for TV season counters.
  const { data: media, error: mediaErr } = await supabase
    .from("media")
    .select("id, media_type")
    .eq("id", mediaId)
    .maybeSingle()
  if (mediaErr) return jsonError(mediaErr.message, 500)
  if (!media) return jsonError("Media not found", 404)

  if (seasonNumber != null) {
    if (media.media_type !== "tv") return jsonError("season_number is only valid for TV shows")
  }

  // Read current count (NULL season needs `is` filter).
  let existingQuery = supabase
    .from("manual_rewatch_counts")
    .select("id, count")
    .eq("user_id", user.id)
    .eq("media_id", mediaId)
  existingQuery = seasonNumber == null
    ? existingQuery.is("season_number", null)
    : existingQuery.eq("season_number", seasonNumber)

  const { data: existing, error: existingErr } = await existingQuery.maybeSingle()
  if (existingErr) return jsonError(existingErr.message, 500)

  const current = typeof existing?.count === "number" ? existing.count : 0
  const next = Math.max(0, current + delta)

  if (existing?.id) {
    const { error: updateErr } = await supabase
      .from("manual_rewatch_counts")
      .update({ count: next })
      .eq("id", existing.id)
      .eq("user_id", user.id)
    if (updateErr) return jsonError(updateErr.message, 500)
  } else if (next > 0) {
    const { error: insertErr } = await supabase
      .from("manual_rewatch_counts")
      .insert({
        user_id: user.id,
        media_id: mediaId,
        season_number: seasonNumber,
        count: next,
      })
    if (insertErr) {
      if (insertErr.code === "23505") {
        let retryQuery = supabase
          .from("manual_rewatch_counts")
          .select("id, count")
          .eq("user_id", user.id)
          .eq("media_id", mediaId)
        retryQuery = seasonNumber == null
          ? retryQuery.is("season_number", null)
          : retryQuery.eq("season_number", seasonNumber)
        const { data: retryRow, error: retryErr } = await retryQuery.maybeSingle()
        if (retryErr || !retryRow) return jsonError(retryErr?.message ?? "Failed to update rewatch count", 500)
        const retryNext = Math.max(0, (retryRow.count ?? 0) + delta)
        const { error: retryUpdateErr } = await supabase
          .from("manual_rewatch_counts")
          .update({ count: retryNext })
          .eq("id", retryRow.id)
          .eq("user_id", user.id)
        if (retryUpdateErr) return jsonError(retryUpdateErr.message, 500)
        return Response.json({ success: true, count: retryNext, media_id: mediaId })
      }
      return jsonError(insertErr.message, 500)
    }
  }

  return Response.json({ success: true, count: next, media_id: mediaId })
}
