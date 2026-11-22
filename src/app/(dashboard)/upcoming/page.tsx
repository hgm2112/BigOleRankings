import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getEligibleUpcomingShowsForUser, getHiddenUpcomingShowsForUser } from "@/lib/upcoming-releases"
import { UpcomingReleasesClient } from "./upcoming-client"

export default async function UpcomingReleasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [shows, hiddenShows] = await Promise.all([
    getEligibleUpcomingShowsForUser(supabase, user.id),
    getHiddenUpcomingShowsForUser(supabase, user.id),
  ])
  return <UpcomingReleasesClient initialShows={shows} initialHiddenShows={hiddenShows} />
}
