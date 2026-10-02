import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { fetchSocialFeed, FEED_DEFAULT_LIMIT } from "@/lib/social-feed"
import { SocialClient } from "./social-client"

export default async function SocialPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const feed = await fetchSocialFeed(supabase, user.id, { limit: FEED_DEFAULT_LIMIT })

  return <SocialClient initialEvents={feed.events} feedNextCursor={feed.nextCursor} />
}
