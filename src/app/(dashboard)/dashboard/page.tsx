import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardClient } from "./dashboard-client"
import { ENTRY_SELECT, flattenEntry, flattenEntries, fetchDnfSeasonKeys } from "@/lib/entry-queries"
import { WATCH_PERIOD_SELECT, normalizeWatchPeriods } from "@/lib/watching"
import { getEligibleUpcomingShowsForUser } from "@/lib/upcoming-releases"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [{ data: entries }, upcomingShows] = await Promise.all([
    supabase
      .from("ratings")
      .select(ENTRY_SELECT)
      .eq("user_id", user.id),
    getEligibleUpcomingShowsForUser(supabase, user.id),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const countdownCandidate = upcomingShows
    .filter((s) => s.upcomingReleaseDate && s.upcomingReleaseDate >= today)
    .sort((a, b) => {
      if (a.upcomingReleaseDate! !== b.upcomingReleaseDate!) {
        return a.upcomingReleaseDate! < b.upcomingReleaseDate! ? -1 : 1
      }
      return a.title.localeCompare(b.title)
    })[0]
  const countdownRelease = countdownCandidate?.upcomingReleaseDate
    ? {
        mediaId: countdownCandidate.mediaId,
        tmdbId: countdownCandidate.tmdbId,
        title: countdownCandidate.title,
        posterPath: countdownCandidate.posterPath,
        year: countdownCandidate.year,
        upcomingSeasonNumber: countdownCandidate.upcomingSeasonNumber,
        upcomingReleaseDate: countdownCandidate.upcomingReleaseDate,
        status: countdownCandidate.status,
      }
    : null

  let countdownAlreadyWatching = false
  if (countdownRelease?.upcomingSeasonNumber != null) {
    const { data: activeCountdownPeriod } = await supabase
      .from("watch_periods")
      .select("id")
      .eq("user_id", user.id)
      .eq("media_id", countdownRelease.mediaId)
      .eq("season_number", countdownRelease.upcomingSeasonNumber)
      .eq("status", "currently_watching")
      .limit(1)
      .maybeSingle()
    countdownAlreadyWatching = !!activeCountdownPeriod
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, pinned_user_id, pinned_user_id_2, pinned_user_id_3")
    .eq("id", user.id)
    .maybeSingle()

  const metaUsername = user.user_metadata?.username as string | undefined
  const emailName = user.email?.split("@")[0]
  const fallbackName = metaUsername || emailName || "User"

  const resolvedProfile = profile?.username
    ? profile
    : { username: fallbackName, display_name: fallbackName }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: pendingDetailed } = await supabase
    .from("ratings")
    .select(ENTRY_SELECT)
    .eq("user_id", user.id)
    .not("gut_rating", "is", null)
    .is("detailed_enjoyment", null)
    .lte("gut_rated_at", sevenDaysAgo)

  const pinColumns = [profile?.pinned_user_id, profile?.pinned_user_id_2, profile?.pinned_user_id_3]
  const pinnedUsers: { username: string | null; display_name: string | null }[] = []
  const pinnedEntries: any[] = []
  const myComparisonEntries: (any | null)[] = []
  const pinnedWatching: any[][] = []

  for (const pinnedUserId of pinColumns) {
    if (!pinnedUserId) {
      pinnedEntries.push(null)
      myComparisonEntries.push(null)
      pinnedWatching.push([])
      continue
    }

    const { data: pinUser } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", pinnedUserId)
      .maybeSingle()

    if (pinUser) {
      pinnedUsers.push(pinUser)

      const [{ data: latest }, { data: watching }] = await Promise.all([
        supabase
          .from("ratings")
          .select(ENTRY_SELECT)
          .eq("user_id", pinnedUserId)
          .not("gut_rating", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("watch_periods")
          .select(WATCH_PERIOD_SELECT)
          .eq("user_id", pinnedUserId)
          .eq("status", "currently_watching")
          .order("started_at", { ascending: false })
          .order("created_at", { ascending: false }),
      ])

      const latestEntry = latest ? flattenEntry(latest) : null
      pinnedEntries.push(latestEntry)
      pinnedWatching.push(normalizeWatchPeriods(watching))

      if (latestEntry) {
        const { data: mine } = await supabase
          .from("ratings")
          .select(ENTRY_SELECT)
          .eq("user_id", user.id)
          .eq("media_id", latestEntry.media_id)
          .maybeSingle()
        myComparisonEntries.push(mine ? flattenEntry(mine) : null)
      } else {
        myComparisonEntries.push(null)
      }
    } else {
      pinnedEntries.push(null)
      myComparisonEntries.push(null)
      pinnedWatching.push([])
    }
  }

  return (
    <DashboardClient
      entries={flattenEntries(entries, await fetchDnfSeasonKeys(supabase, user.id))}
      profile={resolvedProfile}
      pinnedUsers={pinnedUsers}
      pinnedEntries={pinnedEntries}
      myComparisonEntries={myComparisonEntries}
      pinnedWatching={pinnedWatching}
      pendingDetailedEntries={flattenEntries(pendingDetailed)}
      countdownRelease={countdownRelease}
      countdownAlreadyWatching={countdownAlreadyWatching}
    />
  )
}
