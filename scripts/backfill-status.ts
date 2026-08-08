import dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve("/home/hgm2112/projects/BigOleRankings/big-ole-rankings/.env.local") })

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const TMDB_BASE = "https://api.themoviedb.org/3"
const DELAY_MS = 350

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchStatus(tmdbId: number): Promise<string | null> {
  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?language=en-US`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  })
  if (!res.ok) {
    console.error(`  TMDB error ${res.status} for tv/${tmdbId}`)
    return null
  }
  const item = await res.json()
  return item.status ?? null
}

async function main() {
  console.log("Fetching TV entries...")
  const res = await fetch(
    `${URL}/rest/v1/entries?media_type=eq.tv&select=id,tmdb_id,title,status`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  )
  const entries = await res.json()
  console.log(`Found ${entries.length} TV entries`)

  let okCount = 0
  let failCount = 0

  for (const entry of entries) {
    await delay(DELAY_MS)
    const status = await fetchStatus(entry.tmdb_id)
    if (status === null) {
      console.log(`SKIP: ${entry.title} (tmdb:${entry.tmdb_id}) — no status`)
      failCount++
      continue
    }

    const updateRes = await fetch(`${URL}/rest/v1/entries?id=eq.${entry.id}`, {
      method: "PATCH",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })

    if (updateRes.ok) {
      console.log(`OK:   ${entry.title} → ${status}`)
      okCount++
    } else {
      console.log(`FAIL: ${entry.title} — ${await updateRes.text().catch(() => "")}`)
      failCount++
    }
  }

  console.log(`\nDone. ${okCount} updated, ${failCount} skipped/failed`)
}

main().catch(console.error)
