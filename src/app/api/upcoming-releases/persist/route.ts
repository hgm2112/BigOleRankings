import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceSupabaseClient, persistReleaseInfoFromTmdbItem } from "@/lib/upcoming-releases"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const mediaId = typeof body?.media_id === "string" ? body.media_id : null
  const tmdb = body?.tmdb

  if (!mediaId || !tmdb || typeof tmdb !== "object") {
    return Response.json({ error: "media_id and tmdb payload required" }, { status: 400 })
  }

  // Ensure the requesting user has an entry for this TV show and bind payload to that show.
  const { data: rating } = await supabase
    .from("ratings")
    .select("media_id, media:media_id!inner (id, tmdb_id, media_type)")
    .eq("user_id", user.id)
    .eq("media_id", mediaId)
    .maybeSingle()

  const m: any = rating ? (Array.isArray((rating as any).media) ? (rating as any).media[0] : (rating as any).media) : null
  if (!m || m.media_type !== "tv" || typeof m.tmdb_id !== "number") {
    return Response.json({ error: "TV show entry not found for user" }, { status: 404 })
  }

  const payloadTmdbId = typeof tmdb.id === "number" ? tmdb.id : (typeof tmdb.tmdb_id === "number" ? tmdb.tmdb_id : null)
  if (payloadTmdbId == null || payloadTmdbId !== m.tmdb_id) {
    return Response.json({ error: "TMDB payload does not match the requested show" }, { status: 400 })
  }

  const service = createServiceSupabaseClient()
  if (!service) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const result = await persistReleaseInfoFromTmdbItem(service, mediaId, m.tmdb_id as number, tmdb)
  if (!result.ok) {
    // Preserve-previous behavior is handled inside persist; treat as non-fatal for client.
    return Response.json({ ok: false, error: result.error || "Failed to persist release info", result }, { status: 200 })
  }

  return Response.json({ ok: true, result })
}
