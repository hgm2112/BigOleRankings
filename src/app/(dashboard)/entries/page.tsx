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

  const flatEntries = flattenEntries(entries)

  const tvMediaIds = [...new Set(flatEntries.filter((e) => e.media_type === "tv").map((e) => e.media_id))]

  let seasonRatings: {
    media_id: string
    season_number: number
    rating: number | null
    dnf: boolean
  }[] = []

  if (tvMediaIds.length > 0) {
    const { data: rows } = await supabase
      .from("season_ratings")
      .select("media_id, season_number, rating, dnf")
      .eq("user_id", user.id)
      .in("media_id", tvMediaIds)
    seasonRatings = rows ?? []
  }

  return <EntriesClient entries={flatEntries} userId={user.id} seasonRatings={seasonRatings} initialSort={params.sort} initialDir={params.dir} />
}
