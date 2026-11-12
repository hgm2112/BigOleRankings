import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WatchingClient } from "./watching-client"
import { WATCH_PERIOD_SELECT, normalizeWatchPeriods } from "@/lib/watching"

export default async function WatchingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: active } = await supabase
    .from("watch_periods")
    .select(WATCH_PERIOD_SELECT)
    .eq("user_id", user.id)
    .eq("status", "currently_watching")
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false })

  const { data: history } = await supabase
    .from("watch_periods")
    .select(WATCH_PERIOD_SELECT)
    .eq("user_id", user.id)
    .neq("status", "currently_watching")
    .order("ended_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(100)

  return (
    <WatchingClient
      initialActive={normalizeWatchPeriods(active)}
      initialHistory={normalizeWatchPeriods(history)}
    />
  )
}
