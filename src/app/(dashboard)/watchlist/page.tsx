import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { WatchlistClient } from "./watchlist-client"
import { backfillMissingTvSeasonCounts, normalizeWatchlistRows, WATCHLIST_SELECT } from "@/lib/watchlist"

function getServiceClient() {
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceUrl || !serviceKey) return null
  return createServiceClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export default async function WatchlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data } = await supabase
    .from("watchlist")
    .select(WATCHLIST_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  let rows = data ?? []
  const service = getServiceClient()
  const { changed } = await backfillMissingTvSeasonCounts(service, rows)
  if (changed) {
    const { data: refreshed } = await supabase
      .from("watchlist")
      .select(WATCHLIST_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    if (refreshed) rows = refreshed
  }

  return <WatchlistClient initialItems={normalizeWatchlistRows(rows)} />
}
