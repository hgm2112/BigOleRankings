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

interface MediaRow {
  id: string
  tmdb_id: number
  media_type: string
  title: string
  genres: string[] | null
}

async function fetchGenres(tmdbId: number, mediaType: string): Promise<string[] | null> {
  const endpoint = mediaType === "tv" ? `tv/${tmdbId}` : `movie/${tmdbId}`
  const res = await fetch(`${TMDB_BASE}/${endpoint}?language=en-US`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  })
  if (!res.ok) {
    console.error(`  TMDB error ${res.status} for ${endpoint}`)
    return null
  }
  const item = await res.json()
  return (item.genres || []).map((g: { name: string }) => g.name)
}

async function patchMedia(mediaId: string, genres: string[]) {
  const res = await fetch(`${URL}/rest/v1/media?id=eq.${mediaId}`, {
    method: "PATCH",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ genres }),
  })
  return res.ok
}

async function main() {
  const res = await fetch(
    `${URL}/rest/v1/media?select=id,tmdb_id,media_type,title,genres&genres=is.null`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  )
  if (!res.ok) {
    console.error(`Failed to fetch media: ${await res.text().catch(() => "")}`)
    return
  }
  const rows: MediaRow[] = await res.json()
  console.log(`Found ${rows.length} media rows without genres`)

  let okCount = 0
  let skipCount = 0
  let failCount = 0

  for (const row of rows) {
    await delay(DELAY_MS)
    const genres = await fetchGenres(row.tmdb_id, row.media_type)
    if (genres === null || genres.length === 0) {
      console.log(`SKIP: ${row.title} (tmdb:${row.tmdb_id}) — no genres`)
      skipCount++
      continue
    }

    const patched = await patchMedia(row.id, genres)
    if (patched) {
      console.log(`OK:   ${row.title} → ${genres.join(", ")}`)
      okCount++
    } else {
      console.log(`FAIL: ${row.title} (tmdb:${row.tmdb_id})`)
      failCount++
    }
  }

  console.log(`\nDone. ${okCount} updated, ${skipCount} skipped, ${failCount} failed`)
}

main().catch(console.error)
