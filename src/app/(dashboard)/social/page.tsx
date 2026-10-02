import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { fetchSocialFeed, FEED_DEFAULT_LIMIT } from "@/lib/social-feed"
import { SocialClient, type Suggestion } from "./social-client"

const SUGGESTION_LIMIT = 5

export default async function SocialPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [feed, followingRes, profilesRes, ratingsRes] = await Promise.all([
    fetchSocialFeed(supabase, user.id, { limit: FEED_DEFAULT_LIMIT }),
    supabase.from("follows").select("following_id").eq("follower_id", user.id),
    supabase.from("profiles").select("id, username, display_name"),
    supabase.from("ratings").select("user_id"),
  ])

  const followingIds = followingRes.data?.map((f) => f.following_id as string) ?? []
  const followingSet = new Set(followingIds)
  const profiles = profilesRes.data ?? []
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  // Friends-of-friends: who the people you follow are following.
  const friendFollowsRes = followingIds.length > 0
    ? await supabase.from("follows").select("follower_id, following_id").in("follower_id", followingIds)
    : { data: [] as { follower_id: string; following_id: string }[] }

  const fofCount = new Map<string, number>()
  const fofBy = new Map<string, string[]>()
  for (const row of friendFollowsRes.data ?? []) {
    const targetId = row.following_id
    if (targetId === user.id || followingSet.has(targetId)) continue
    const friend = profileById.get(row.follower_id)
    const friendName = friend?.display_name || friend?.username || "a friend"
    fofCount.set(targetId, (fofCount.get(targetId) ?? 0) + 1)
    const names = fofBy.get(targetId) ?? []
    names.push(friendName)
    fofBy.set(targetId, names)
  }

  const ratingCount = new Map<string, number>()
  for (const row of ratingsRes.data ?? []) {
    const id = row.user_id as string
    ratingCount.set(id, (ratingCount.get(id) ?? 0) + 1)
  }

  const suggestions = profiles
    .filter((p) => p.id !== user.id && !followingSet.has(p.id))
    .sort((a, b) => {
      const fofDiff = (fofCount.get(b.id) ?? 0) - (fofCount.get(a.id) ?? 0)
      if (fofDiff !== 0) return fofDiff
      const ratingDiff = (ratingCount.get(b.id) ?? 0) - (ratingCount.get(a.id) ?? 0)
      if (ratingDiff !== 0) return ratingDiff
      return (a.username ?? "").localeCompare(b.username ?? "")
    })
    .slice(0, SUGGESTION_LIMIT)
    .map<Suggestion>((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      ratingCount: ratingCount.get(p.id) ?? 0,
      fofBy: fofBy.get(p.id) ?? [],
    }))

  return (
    <SocialClient
      initialEvents={feed.events}
      feedNextCursor={feed.nextCursor}
      suggestions={suggestions}
    />
  )
}
