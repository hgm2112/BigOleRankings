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
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle()

  const metaUsername = user.user_metadata?.username as string | undefined
  const emailName = user.email?.split("@")[0]
  const resolvedProfile = profile?.username
    ? profile
    : { username: metaUsername || emailName || "User", display_name: metaUsername || emailName || "User" }

  return <DashboardClient entries={entries || []} profile={resolvedProfile} />
}
