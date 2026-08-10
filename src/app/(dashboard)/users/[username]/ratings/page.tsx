import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { EntriesClient } from "../../../entries/entries-client"
import { ENTRY_SELECT, flattenEntries } from "@/lib/entry-queries"

export default async function UserRatingsPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ sort?: string; dir?: string }> }) {
  const { username } = await params
  const query = await searchParams
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
    .from("ratings")
    .select(ENTRY_SELECT)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })

  return (
    <EntriesClient
      entries={flattenEntries(entries)}
      userId={profile.id}
      initialSort={query.sort}
      initialDir={query.dir}
      title={`${profile.display_name || profile.username}'s Ratings`}
      description={
        <Link href={`/users/${profile.username}`} className="hover:underline">
          Back to {profile.display_name || profile.username}&rsquo;s dashboard
        </Link>
      }
      showAddButton={false}
      readOnly
      basePath={`/users/${profile.username}/ratings`}
    />
  )
}
