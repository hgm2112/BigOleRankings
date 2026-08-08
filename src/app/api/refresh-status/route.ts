import { NextRequest } from "next/server"
import { after } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 60

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TMDB_BASE = "https://api.themoviedb.org/3"
const DELAY_MS = 250

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function refreshStatuses() {
  if (!TMDB_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("refresh-status: missing env vars")
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: entries } = await supabase
    .from("entries")
    .select("id, tmdb_id, status")
    .eq("media_type", "tv")
    .or("status.eq.Returning Series,status.is.null")

  if (!entries || entries.length === 0) return

  let updated = 0
  for (const entry of entries) {
    await delay(DELAY_MS)
    try {
      const res = await fetch(`${TMDB_BASE}/tv/${entry.tmdb_id}?language=en-US`, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
      })
      if (!res.ok) continue
      const item = await res.json()
      const status: string | null = item.status ?? null
      if (status && status !== entry.status) {
        await supabase.from("entries").update({ status }).eq("id", entry.id)
        updated++
      }
    } catch (error) {
      console.error(`refresh-status: failed for tv/${entry.tmdb_id}`, error)
    }
  }

  console.log(`refresh-status: checked ${entries.length}, updated ${updated}`)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  after(() => refreshStatuses())

  return Response.json({ success: true })
}
