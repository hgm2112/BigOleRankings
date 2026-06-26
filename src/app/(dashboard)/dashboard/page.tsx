import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", user.id)

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

  const pinColumns = [profile?.pinned_user_id, profile?.pinned_user_id_2, profile?.pinned_user_id_3]
  const pinnedUsers: { username: string | null; display_name: string | null }[] = []
  const pinnedEntries: any[] = []
  const myComparisonEntries: (any | null)[] = []

  for (const pinnedUserId of pinColumns) {
    if (!pinnedUserId) {
      pinnedEntries.push(null)
      myComparisonEntries.push(null)
      continue
    }

    const { data: pinUser } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", pinnedUserId)
      .maybeSingle()

    if (pinUser) {
      pinnedUsers.push(pinUser)

      const { data: latest } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", pinnedUserId)
        .not("gut_rating", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      pinnedEntries.push(latest ?? null)

      if (latest) {
        const { data: mine } = await supabase
          .from("entries")
          .select("*")
          .eq("user_id", user.id)
          .eq("tmdb_id", latest.tmdb_id)
          .eq("media_type", latest.media_type)
          .maybeSingle()
        myComparisonEntries.push(mine ?? null)
      } else {
        myComparisonEntries.push(null)
      }
    } else {
      pinnedEntries.push(null)
      myComparisonEntries.push(null)
    }
  }

  return (
    <DashboardClient
      entries={entries || []}
      profile={resolvedProfile}
      pinnedUsers={pinnedUsers}
      pinnedEntries={pinnedEntries}
      myComparisonEntries={myComparisonEntries}
    />
  )
}
