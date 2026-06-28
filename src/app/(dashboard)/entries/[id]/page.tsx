import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { notFound } from "next/navigation"
import { EntryDetailClient } from "./entry-detail-client"

export default async function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: entry } = await supabase
    .from("entries")
    .select("*")
    .eq("id", id)
    .single()

  if (!entry) notFound()

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", entry.user_id)
    .maybeSingle()

  const isOwner = user.id === entry.user_id

  const { data: myComparisonEntry } = isOwner
    ? { data: null }
    : await supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("tmdb_id", entry.tmdb_id)
        .eq("media_type", entry.media_type)
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
        .from("entries")
        .select("user_id, gut_rating, gut_rated_at, detailed_enjoyment, detailed_impact, detailed_recommend, detailed_watch_again, detailed_rated_at")
        .in("user_id", followerIds)
        .eq("tmdb_id", entry.tmdb_id)
        .eq("media_type", entry.media_type)
        .not("gut_rating", "is", null)

      if (followerEntries && followerProfiles) {
        const profileMap = new Map(followerProfiles.map(p => [p.id, p]))
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
          }
        })
      }
    }
  }

  return (
    <EntryDetailClient
      entry={entry}
      ownerProfile={ownerProfile}
      isOwner={isOwner}
      myComparisonEntry={myComparisonEntry}
      followerRatings={followerRatings}
    />
  )
}
