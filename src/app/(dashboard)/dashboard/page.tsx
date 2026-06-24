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
    .select("username, display_name, pinned_user_id")
    .eq("id", user.id)
    .maybeSingle()

  const metaUsername = user.user_metadata?.username as string | undefined
  const emailName = user.email?.split("@")[0]
  const fallbackName = metaUsername || emailName || "User"

  const resolvedProfile = profile?.username
    ? profile
    : { username: fallbackName, display_name: fallbackName }

  let pinnedUser: { username: string | null; display_name: string | null } | null = null
  let pinnedEntry: any = null
  let myComparisonEntry: any = null

  if (profile?.pinned_user_id) {
    const { data: pinUser } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", profile.pinned_user_id)
      .single()

    if (pinUser) {
      pinnedUser = pinUser

      const { data: latest } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", profile.pinned_user_id)
        .not("gut_rating", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latest) {
        pinnedEntry = latest

        const { data: mine } = await supabase
          .from("entries")
          .select("*")
          .eq("user_id", user.id)
          .eq("tmdb_id", latest.tmdb_id)
          .eq("media_type", latest.media_type)
          .maybeSingle()

        myComparisonEntry = mine
      }
    }
  }

  return (
    <DashboardClient
      entries={entries || []}
      profile={resolvedProfile}
      pinnedUser={pinnedUser}
      pinnedEntry={pinnedEntry}
      myComparisonEntry={myComparisonEntry}
    />
  )
}
