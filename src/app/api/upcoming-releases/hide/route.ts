import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const mediaId = typeof body?.media_id === "string" ? body.media_id : null
  const hidden = typeof body?.hidden === "boolean" ? body.hidden : null

  if (!mediaId || hidden == null) {
    return Response.json({ error: "media_id and hidden required" }, { status: 400 })
  }

  if (hidden) {
    const { error } = await supabase
      .from("upcoming_release_hides")
      .upsert({ user_id: user.id, media_id: mediaId }, { onConflict: "user_id,media_id" })
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  } else {
    const { error } = await supabase
      .from("upcoming_release_hides")
      .delete()
      .eq("user_id", user.id)
      .eq("media_id", mediaId)
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }

  return Response.json({ ok: true })
}
