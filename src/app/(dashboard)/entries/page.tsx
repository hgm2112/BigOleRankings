import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EntriesClient } from "./entries-client"
import { ENTRY_SELECT, flattenEntries } from "@/lib/entry-queries"

export default async function EntriesPage({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: entries } = await supabase
    .from("ratings")
    .select(ENTRY_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return <EntriesClient entries={flattenEntries(entries)} userId={user.id} initialSort={params.sort} initialDir={params.dir} />
}
