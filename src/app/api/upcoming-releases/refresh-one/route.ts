import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceSupabaseClient, fetchAndPersistShowReleaseInfo } from "@/lib/upcoming-releases"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const token = process.env.TMDB_ACCESS_TOKEN
  if (!token) {
    return Response.json({ error: "TMDB access token not configured" }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const mediaId = typeof body?.media_id === "string" ? body.media_id : null
  if (!mediaId) {
    return Response.json({ error: "media_id required" }, { status: 400 })
  }

  // Ensure the requesting user has an entry for this TV show (scoped, on-demand).
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

  const service = createServiceSupabaseClient()
  if (!service) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const result = await fetchAndPersistShowReleaseInfo(service, mediaId, m.tmdb_id as number, token)
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error || "Failed to refresh" }, { status: 502 })
  }

  return Response.json({ ok: true, result })
}
