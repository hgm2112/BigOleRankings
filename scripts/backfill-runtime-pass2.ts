import dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve("/home/hgm2112/projects/BigOleRankings/big-ole-rankings/.env.local") })

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const TMDB_BASE = "https://api.themoviedb.org/3"
const DELAY_MS = 350

const MANUAL_RUNTIMES: Record<string, number> = {
  "1679207": 143, // EPIC: The Musical
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchShowSeasons(tmdbId: number): Promise<number | null> {
  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?language=en-US`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  })
  if (!res.ok) return null
  const show = await res.json()
  const numSeasons = show.number_of_seasons ?? 0

  let totalRuntime = 0
  for (let s = 1; s <= numSeasons; s++) {
    await delay(DELAY_MS)
    const seasonRes = await fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${s}?language=en-US`, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
    })
    if (!seasonRes.ok) continue
    const season = await seasonRes.json()
    const episodes = season.episodes ?? []
    for (const ep of episodes) {
      totalRuntime += ep.runtime ?? 0
    }
  }

  return totalRuntime > 0 ? totalRuntime : null
}

async function main() {
  console.log("Fetching entries with null runtime...")
  const res = await fetch(
    `${URL}/rest/v1/entries?runtime=is.null&select=id,tmdb_id,media_type,title`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  )
  const entries = await res.json()
  console.log(`Found ${entries.length} entries`)

  // Deduplicate by tmdb_id+media_type
  const seen = new Set<string>()
  const unique: typeof entries = []
  for (const e of entries) {
    const key = `${e.tmdb_id}:${e.media_type}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(e)
    }
  }
  console.log(`Unique (tmdb_id, media_type) pairs: ${unique.length}`)

  let okCount = 0
  let failCount = 0

  for (const entry of unique) {
    const manualKey = String(entry.tmdb_id)
    let runtime: number | null

    if (manualKey in MANUAL_RUNTIMES) {
      runtime = MANUAL_RUNTIMES[manualKey]
      console.log(`MANUAL: ${entry.title} → ${runtime}min`)
    } else if (entry.media_type !== "tv") {
      console.log(`SKIP: ${entry.title} (${entry.media_type}) — not a TV show`)
      failCount++
      continue
    } else {
      await delay(DELAY_MS)
      runtime = await fetchShowSeasons(entry.tmdb_id)
      if (runtime === null) {
        console.log(`SKIP: ${entry.title} (${entry.media_type}, tmdb:${entry.tmdb_id}) — no season runtime data`)
        failCount++
        continue
      }
      console.log(`TMDB: ${entry.title} → ${runtime}min (${entry.tmdb_id})`)
    }

    // Update all entries with this tmdb_id+media_type
    const updateRes = await fetch(
      `${URL}/rest/v1/entries?tmdb_id=eq.${entry.tmdb_id}&media_type=eq.${entry.media_type}&runtime=is.null`,
      {
        method: "PATCH",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ runtime }),
      },
    )

    if (updateRes.ok) {
      const text = await updateRes.text()
      const count = text ? JSON.parse(text)?.length ?? "?" : "?"
      console.log(`  → updated ${count} entries`)
      okCount++
    } else {
      console.log(`  → FAILED: ${await updateRes.text().catch(() => "")}`)
      failCount++
    }
  }

  console.log(`\nDone. ${okCount} unique shows resolved, ${failCount} failed`)
}

main().catch(console.error)
