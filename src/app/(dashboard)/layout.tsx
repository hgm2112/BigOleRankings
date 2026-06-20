import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardNav } from "@/components/dashboard-nav"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .single()

  if (!profile) {
    const username = user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`
    await supabase.from("profiles").upsert({ id: user.id, username, display_name: username })
    profile = { username, display_name: username, avatar_url: null }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardNav user={user} profile={profile} />
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
