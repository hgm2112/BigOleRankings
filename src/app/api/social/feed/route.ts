import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchSocialFeed, FEED_DEFAULT_LIMIT, FEED_MAX_LIMIT } from "@/lib/social-feed"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const before = params.get("before")
  const limitRaw = Number.parseInt(params.get("limit") ?? "", 10)
  const limit = Number.isNaN(limitRaw) ? FEED_DEFAULT_LIMIT : Math.min(Math.max(limitRaw, 1), FEED_MAX_LIMIT)

  if (before && Number.isNaN(Date.parse(before))) {
    return Response.json({ error: "Invalid cursor" }, { status: 400 })
  }

  const page = await fetchSocialFeed(supabase, user.id, { limit, before })
  return Response.json(page)
}
