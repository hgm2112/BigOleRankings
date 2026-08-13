import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { notFound } from "next/navigation"
import { EntryDetailClient } from "./entry-detail-client"
import { ENTRY_SELECT, flattenEntry } from "@/lib/entry-queries"

export default async function EntryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string; dir?: string; back?: string }> }) {
  const { id } = await params
  const query = await searchParams
  const backParams = new URLSearchParams()
  if (query.sort && query.sort !== "recent") backParams.set("sort", query.sort)
  if (query.dir) backParams.set("dir", query.dir)
  const backBase = query.back && query.back.startsWith("/") && !query.back.startsWith("//") ? query.back : "/entries"
  const backUrl = backParams.toString() ? `${backBase}?${backParams.toString()}` : backBase
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: row } = await supabase
    .from("ratings")
    .select(ENTRY_SELECT)
    .eq("id", id)
    .single()

  if (!row) notFound()

  const entry = flattenEntry(row)

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", entry.user_id)
    .maybeSingle()

  const isOwner = user.id === entry.user_id

  const { data: myComparisonEntry } = isOwner
    ? { data: null }
    : await supabase
        .from("ratings")
        .select(ENTRY_SELECT)
        .eq("user_id", user.id)
        .eq("media_id", entry.media_id)
        .maybeSingle()

  let followerRatings: {
    username: string
    display_name: string | null
    gut_rating: number
    gut_rated_at: string | null
    detailed_enjoyment: number | null
    detailed_impact: number | null
    detailed_recommend: number | null
    detailed_watch_again: number | null
    detailed_rated_at: string | null
    season_ratings: { season_number: number; rating: number | null; dnf: boolean }[]
  }[] = []

  if (isOwner) {
    const { data: followers } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", user.id)

    if (followers && followers.length > 0) {
      const followerIds = followers.map(f => f.follower_id)

      const { data: followerProfiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", followerIds)

      const { data: followerEntries } = await supabase
        .from("ratings")
        .select("user_id, gut_rating, gut_rated_at, detailed_enjoyment, detailed_impact, detailed_recommend, detailed_watch_again, detailed_rated_at")
        .in("user_id", followerIds)
        .eq("media_id", entry.media_id)
        .not("gut_rating", "is", null)

      if (followerEntries && followerProfiles) {
        const profileMap = new Map(followerProfiles.map(p => [p.id, p]))

        let seasonRatingsByUser = new Map<string, { season_number: number; rating: number | null; dnf: boolean }[]>()
        if (entry.media_type === "tv") {
          const { data: followerSeasonRatings } = await supabase
            .from("season_ratings")
            .select("user_id, season_number, rating, dnf")
            .in("user_id", followerIds)
            .eq("media_id", entry.media_id)

          if (followerSeasonRatings) {
            seasonRatingsByUser = new Map()
            for (const sr of followerSeasonRatings) {
              const list = seasonRatingsByUser.get(sr.user_id) ?? []
              list.push({ season_number: sr.season_number, rating: sr.rating, dnf: sr.dnf })
              seasonRatingsByUser.set(sr.user_id, list)
            }
          }
        }

        followerRatings = followerEntries.map(e => {
          const profile = profileMap.get(e.user_id)
          return {
            username: profile?.username ?? "unknown",
            display_name: profile?.display_name ?? null,
            gut_rating: e.gut_rating,
            gut_rated_at: e.gut_rated_at,
            detailed_enjoyment: e.detailed_enjoyment,
            detailed_impact: e.detailed_impact,
            detailed_recommend: e.detailed_recommend,
            detailed_watch_again: e.detailed_watch_again,
            detailed_rated_at: e.detailed_rated_at,
            season_ratings: seasonRatingsByUser.get(e.user_id) ?? [],
          }
        })
      }
    }
  }

  let seasons: {
    season_number: number
    name: string | null
    air_year: number | null
    episode_count: number | null
  }[] = []

  let seasonRatings: {
    media_id: string
    season_number: number
    rating: number | null
    dnf: boolean
  }[] = []

  let mySeasonRatings: {
    media_id: string
    season_number: number
    rating: number | null
    dnf: boolean
  }[] = []

  if (entry.media_type === "tv") {
    const { data: seasonRows } = await supabase
      .from("seasons")
      .select("season_number, name, air_year, episode_count")
      .eq("media_id", entry.media_id)
      .order("season_number")

    seasons = seasonRows ?? []

    const { data: seasonRatingRows } = await supabase
      .from("season_ratings")
      .select("media_id, season_number, rating, dnf")
      .eq("user_id", entry.user_id)
      .eq("media_id", entry.media_id)

    seasonRatings = seasonRatingRows ?? []

    if (!isOwner) {
      const { data: mySeasonRatingRows } = await supabase
        .from("season_ratings")
        .select("media_id, season_number, rating, dnf")
        .eq("user_id", user.id)
        .eq("media_id", entry.media_id)
        .order("season_number")

      mySeasonRatings = mySeasonRatingRows ?? []
    }
  }

  return (
    <EntryDetailClient
      entry={entry}
      ownerProfile={ownerProfile}
      isOwner={isOwner}
      myComparisonEntry={myComparisonEntry ? flattenEntry(myComparisonEntry) : null}
      followerRatings={followerRatings}
      backUrl={backUrl}
      userId={user.id}
      seasons={seasons}
      seasonRatings={seasonRatings}
      mySeasonRatings={mySeasonRatings}
    />
  )
}
