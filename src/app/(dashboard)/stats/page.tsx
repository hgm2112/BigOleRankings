import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ENTRY_SELECT, flattenEntries, fetchDnfSeasonKeys } from "@/lib/entry-queries"
import type { FlatEntry } from "@/lib/entry-queries"
import { StatsClient } from "./stats-client"

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

  return <StatsClient self={self} following={following} entriesByUser={entriesByUser} />
}
