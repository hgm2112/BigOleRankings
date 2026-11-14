import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getEligibleUpcomingShowsForUser } from "@/lib/upcoming-releases"
import { UpcomingReleasesClient } from "./upcoming-client"

export default async function UpcomingReleasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const shows = await getEligibleUpcomingShowsForUser(supabase, user.id)
  return <UpcomingReleasesClient initialShows={shows} />
}
