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

interface Show {
  id: string
  media: { tmdb_id: number; title: string }
}

interface Season {
  media_id: string
  season_number: number
  name: string | null
  air_year: number | null
  episode_count: number
}

async function fetchShow(tmdbId: number) {
  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?language=en-US`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  })
  if (!res.ok) {
    console.error(`  TMDB error ${res.status} for tv/${tmdbId}`)
    return null
  }
  return res.json()
}

async function patchShow(showId: string, fields: Record<string, unknown>) {
  const res = await fetch(`${URL}/rest/v1/tv_shows?id=eq.${showId}`, {
    method: "PATCH",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  })
  return res.ok
}

async function upsertSeasons(seasons: Season[]) {
  const res = await fetch(`${URL}/rest/v1/seasons?on_conflict=media_id,season_number`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(seasons),
  })
  return res.ok
}

async function main() {
  console.log("Fetching TV shows...")
  const res = await fetch(
    `${URL}/rest/v1/tv_shows?select=id,media:media(tmdb_id,title)`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  )
  if (!res.ok) {
    console.error(`Failed to fetch shows: ${await res.text().catch(() => "")}`)
    return
  }
  const shows: Show[] = await res.json()
  console.log(`Found ${shows.length} TV shows`)

  let okCount = 0
  let skipCount = 0
  let failCount = 0

  for (const show of shows) {
    const tmdbId = show.media?.tmdb_id
    const title = show.media?.title

    if (!tmdbId) {
      console.log(`SKIP: ${show.id} — no tmdb_id`)
      skipCount++
      continue
    }

    await delay(DELAY_MS)
    const item = await fetchShow(tmdbId)
    if (item === null) {
      console.log(`FAIL: ${title} (tmdb:${tmdbId}) — TMDB error`)
      failCount++
      continue
    }

    const patched = await patchShow(show.id, {
      status: item.status ?? null,
      next_air_date: item.next_episode_to_air?.air_date ?? null,
      episode_runtime: item.episode_run_time?.[0] ?? null,
      network: item.networks?.[0]?.name ?? null,
    })

    const seasons: Season[] = (item.seasons || [])
      .filter((s: any) => s.season_number >= 1)
      .map((s: any) => ({
        media_id: show.id,
        season_number: s.season_number,
        name: s.name,
        air_year: s.air_date ? Number(s.air_date.slice(0, 4)) : null,
        episode_count: s.episode_count ?? 0,
      }))

    if (seasons.length === 0) {
      console.log(`SKIP: ${title} (tmdb:${tmdbId}) — no seasons`)
      skipCount++
      continue
    }

    const seasonsOk = await upsertSeasons(seasons)

    if (patched && seasonsOk) {
      console.log(`OK:   ${title} (tmdb:${tmdbId}) → ${seasons.length} seasons`)
      okCount++
    } else {
      console.log(`FAIL: ${title} (tmdb:${tmdbId}) — patch=${patched} seasons=${seasonsOk}`)
      failCount++
    }
  }

  console.log(`\nDone. ${okCount} updated, ${skipCount} skipped, ${failCount} failed`)
}

main().catch(console.error)
