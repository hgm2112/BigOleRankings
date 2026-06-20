import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardNav } from "@/components/dashboard-nav"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle()

  const metaUsername = user.user_metadata?.username as string | undefined
  const emailName = user.email?.split("@")[0]
  const fallbackName = metaUsername || emailName || "User"

  const resolvedProfile = profile?.username
    ? profile
    : { username: fallbackName, display_name: fallbackName, avatar_url: null }

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardNav user={user} profile={resolvedProfile} />
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
