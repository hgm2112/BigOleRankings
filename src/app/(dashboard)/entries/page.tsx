import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EntriesClient } from "./entries-client"

export default async function EntriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return <EntriesClient entries={entries || []} userId={user.id} />
}
