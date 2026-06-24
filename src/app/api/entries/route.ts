import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()

  const { error } = await supabase.from("entries").insert({
    user_id: user.id,
    tmdb_id: body.tmdb_id,
    media_type: body.media_type,
    title: body.title,
    poster_path: body.poster_path,
    year: body.year,
    gut_rating: body.gut_rating,
    gut_rated_at: new Date().toISOString(),
    weight: body.weight ?? 0,
    notes: body.notes || "",
    runtime: body.runtime ?? null,
  })

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "You've already rated this title!" }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
