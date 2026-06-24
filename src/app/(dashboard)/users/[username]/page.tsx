import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { DashboardClient } from "../../dashboard/dashboard-client"

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
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

  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", profile.id)

  return (
    <DashboardClient
      entries={entries || []}
      profile={profile}
      headerTitle={`${profile.display_name || profile.username}'s Rankings`}
      headerDescription=""
    />
  )
}
