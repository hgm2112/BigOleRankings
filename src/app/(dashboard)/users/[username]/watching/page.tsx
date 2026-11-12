import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { WATCH_PERIOD_SELECT, normalizeWatchPeriods } from "@/lib/watching"
import { UserWatchingView } from "./user-watching-view"

export default async function UserWatchingPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username)
    .maybeSingle()

  if (!profile) notFound()

  const [{ data: active }, { data: history }] = await Promise.all([
    supabase
      .from("watch_periods")
      .select(WATCH_PERIOD_SELECT)
      .eq("user_id", profile.id)
      .eq("status", "currently_watching")
      .order("started_at", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("watch_periods")
      .select(WATCH_PERIOD_SELECT)
      .eq("user_id", profile.id)
      .neq("status", "currently_watching")
      .order("ended_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(100),
  ])

  const activePeriods = normalizeWatchPeriods(active)
  const historyPeriods = normalizeWatchPeriods(history)

  const tvKeys = Array.from(new Set(
    [...activePeriods, ...historyPeriods]
      .filter((p) => p.media_type === "tv" && p.season_number != null)
      .map((p) => `${p.media_id}:${p.season_number}`)
  ))

  let seasonRatings: Record<string, { rating: number | null; dnf: boolean }> = {}
  if (tvKeys.length > 0) {
    const mediaIds = Array.from(new Set(tvKeys.map((k) => k.split(":")[0])))
    const { data: ratings } = await supabase
      .from("season_ratings")
      .select("media_id, season_number, rating, dnf")
      .eq("user_id", profile.id)
      .in("media_id", mediaIds)

    seasonRatings = Object.fromEntries(
      (ratings ?? [])
        .filter((r: any) => r?.media_id && r?.season_number != null)
        .map((r: any) => [`${r.media_id}:${r.season_number}`, { rating: r.rating ?? null, dnf: !!r.dnf }])
    )
  }

  return (
    <UserWatchingView
      profile={profile}
      active={activePeriods}
      history={historyPeriods}
      seasonRatings={seasonRatings}
    />
  )
}
