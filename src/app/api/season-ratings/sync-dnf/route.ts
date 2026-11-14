import { NextRequest } from "next/server"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { syncDnfToPeriod } from "@/lib/season-rating-dnf-sync"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_SEASON_NUMBERS = 50

export async function POST(request: NextRequest) {
  const supabase = await createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const mediaId = typeof body?.media_id === "string" ? body.media_id : null
  const seasonNumbersInput: unknown[] = Array.isArray(body?.season_numbers) ? body.season_numbers : []

  if (!mediaId || !UUID_RE.test(mediaId)) {
    return Response.json({ error: "valid media_id (uuid) required" }, { status: 400 })
  }

  if (seasonNumbersInput.length > MAX_SEASON_NUMBERS) {
    return Response.json({ error: `season_numbers limited to ${MAX_SEASON_NUMBERS}` }, { status: 400 })
  }

  const seasons = seasonNumbersInput.filter(
    (n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1
  )

  const results = []
  for (const seasonNumber of seasons) {
    const outcome = await syncDnfToPeriod(supabase, user.id, mediaId, seasonNumber)
    results.push({ season_number: seasonNumber, ...outcome })
  }

  const hasError = results.some((r) => r.status === "error")
  return Response.json({ success: !hasError, results }, { status: hasError ? 500 : 200 })
}
