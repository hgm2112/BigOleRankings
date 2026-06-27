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

async function fetchRuntime(tmdbId: number, mediaType: string): Promise<number | null> {
  const endpoint = mediaType === "tv" ? `tv/${tmdbId}` : `movie/${tmdbId}`
  const res = await fetch(`${TMDB_BASE}/${endpoint}?language=en-US`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  })
  if (!res.ok) {
    console.error(`  TMDB error ${res.status} for ${endpoint}`)
    return null
  }
  const item = await res.json()
  if (mediaType === "tv") {
    return (item.episode_run_time?.[0] || 0) * (item.number_of_episodes || 0)
  }
  return item.runtime ?? null
}

async function main() {
  console.log("Fetching entries with null runtime...")
  const res = await fetch(
    `${URL}/rest/v1/entries?runtime=is.null&select=id,tmdb_id,media_type,title`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  )
  const entries = await res.json()
  console.log(`Found ${entries.length} entries`)

  let okCount = 0
  let failCount = 0

  for (const entry of entries) {
    const lookupType = entry.media_type === "tv" ? "tv" : "movie"

    await delay(DELAY_MS)
    const runtime = await fetchRuntime(entry.tmdb_id, lookupType)
    if (runtime === null || runtime === 0) {
      console.log(`SKIP: ${entry.title} (${entry.media_type}, tmdb:${entry.tmdb_id}) — no runtime`)
      failCount++
      continue
    }

    const updateRes = await fetch(`${URL}/rest/v1/entries?id=eq.${entry.id}`, {
      method: "PATCH",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ runtime }),
    })

    if (updateRes.ok) {
      console.log(`OK:   ${entry.title} (${entry.media_type}) → ${runtime}min`)
      okCount++
    } else {
      console.log(`FAIL: ${entry.title} — ${await updateRes.text().catch(() => "")}`)
      failCount++
    }
  }

  console.log(`\nDone. ${okCount} updated, ${failCount} skipped/failed`)
}

main().catch(console.error)
