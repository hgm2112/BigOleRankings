import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ENTRY_SELECT, flattenEntries, fetchDnfSeasonKeys } from "@/lib/entry-queries"
import type { FlatEntry } from "@/lib/entry-queries"
import { StatsClient, type SharedRating } from "./stats-client"

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: followsData } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)

  const followingIds = followsData?.map((f) => f.following_id) ?? []

  const ids = [user.id, ...followingIds]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", ids)

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

  const resolveName = (id: string) => {
    const p = profileById.get(id)
    return p?.display_name || p?.username || "User"
  }

  const self = { id: user.id, name: resolveName(user.id) }

  const following = followingIds
    .map((id) => profileById.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => ({ id: p.id, name: p.display_name || p.username || "User" }))

  const users = [self, ...following]

  const entriesByUser: Record<string, FlatEntry[]> = {}
  await Promise.all(
    users.map(async (u) => {
      const { data: entries } = await supabase
        .from("ratings")
        .select(ENTRY_SELECT)
        .eq("user_id", u.id)
      entriesByUser[u.id] = flattenEntries(entries, await fetchDnfSeasonKeys(supabase, u.id))
    })
  )

  const { data: allRatings } = await supabase
    .from("ratings")
    .select("user_id, media_id, gut_rating, detailed_enjoyment, detailed_impact, detailed_recommend, detailed_watch_again, media:media_id (title, media_type, year, poster_path)")
    .not("gut_rating", "is", null)

  const sharedMap = new Map<string, {
    media: { title: string; media_type: string; year: number | null; poster_path: string | null }
    users: Map<string, number>
    detailed: number[]
  }>()
  for (const row of allRatings ?? []) {
    const media = Array.isArray(row.media) ? row.media[0] : row.media
    const m = media as { title?: string; media_type?: string; year?: number | null; poster_path?: string | null } | null
    if (!m?.title || !m.media_type) continue
    let entry = sharedMap.get(row.media_id)
    if (!entry) {
      entry = {
        media: { title: m.title, media_type: m.media_type, year: m.year ?? null, poster_path: m.poster_path ?? null },
        users: new Map(),
        detailed: [],
      }
      sharedMap.set(row.media_id, entry)
    }
    if (!entry.users.has(row.user_id) && row.gut_rating != null) {
      entry.users.set(row.user_id, row.gut_rating)
    }
    if (row.detailed_enjoyment != null && row.detailed_impact != null) {
      entry.detailed.push(row.detailed_enjoyment + row.detailed_impact + (row.detailed_recommend ?? 0) + (row.detailed_watch_again ?? 0))
    }
  }

  const sharedRatings: SharedRating[] = []
  for (const [mediaId, { media, users, detailed }] of sharedMap) {
    if (users.size < 2) continue
    const gutValues = [...users.values()]
    sharedRatings.push({
      media_id: mediaId,
      title: media.title,
      media_type: media.media_type,
      year: media.year,
      poster_path: media.poster_path,
      viewers: users.size,
      avgGut: gutValues.length > 0 ? Math.round((gutValues.reduce((a, b) => a + b, 0) / gutValues.length) * 10) / 10 : null,
      avgDetailed: detailed.length > 0 ? Math.round((detailed.reduce((a, b) => a + b, 0) / detailed.length) * 10) / 10 : null,
    })
  }

  return <StatsClient self={self} following={following} entriesByUser={entriesByUser} sharedRatings={sharedRatings} />
}
