import dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const TMDB_BASE = "https://api.themoviedb.org/3"
const DELAY_MS = 350

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

async function fetchSeasonRuntime(tmdbId: number, seasonNumber: number): Promise<number | null> {
  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${seasonNumber}?language=en-US`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  })
  if (!res.ok) {
    console.error(`  TMDB error ${res.status} for tv/${tmdbId}/season/${seasonNumber}`)
    return null
  }
  const season = await res.json()
  const runtimes = (season.episodes ?? [])
    .map((ep: any) => ep.runtime)
    .filter((r: any) => typeof r === "number" && r > 0)
  return median(runtimes)
}

async function upsertEpisodeRuntime(mediaId: string, seasonNumber: number, episodeRuntime: number) {
  const res = await fetch(`${URL}/rest/v1/seasons?on_conflict=media_id,season_number`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify([{ media_id: mediaId, season_number: seasonNumber, episode_runtime: episodeRuntime }]),
  })
  return res.ok
}

async function main() {
  console.log("Fetching seasons with null episode_runtime...")
  const res = await fetch(
    `${URL}/rest/v1/seasons?episode_runtime=is.null&select=media_id,season_number,media:media_id(tmdb_id,title)`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  )
  if (!res.ok) {
    console.error(`Failed to fetch seasons: ${await res.text().catch(() => "")}`)
    return
  }
  const seasons: any[] = await res.json()
  console.log(`Found ${seasons.length} seasons to backfill`)

  let okCount = 0
  let skipCount = 0
  let failCount = 0

  for (const season of seasons) {
    const tmdbId = season.media?.tmdb_id
    const title = season.media?.title

    if (!tmdbId) {
      console.log(`SKIP: ${season.media_id} S${season.season_number} — no tmdb_id`)
      skipCount++
      continue
    }

    await delay(DELAY_MS)
    const runtime = await fetchSeasonRuntime(tmdbId, season.season_number)
    if (runtime === null) {
      console.log(`SKIP: ${title} S${season.season_number} — no episode runtimes`)
      skipCount++
      continue
    }

    const ok = await upsertEpisodeRuntime(season.media_id, season.season_number, runtime)
    if (ok) {
      console.log(`OK:   ${title} S${season.season_number} → ${runtime}min`)
      okCount++
    } else {
      console.log(`FAIL: ${title} S${season.season_number} — upsert failed`)
      failCount++
    }
  }

  console.log(`\nDone. ${okCount} updated, ${skipCount} skipped, ${failCount} failed`)
}

main().catch(console.error)
