import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ENTRY_SELECT, flattenEntries, fetchDnfSeasonKeys } from "@/lib/entry-queries"
import { StatsClient } from "./stats-client"

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: entries } = await supabase
    .from("ratings")
    .select(ENTRY_SELECT)
    .eq("user_id", user.id)

  return <StatsClient entries={flattenEntries(entries, await fetchDnfSeasonKeys(supabase, user.id))} />
}
