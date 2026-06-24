import dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN!

async function sf(path: string, method: string, body?: any) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  }
  if (method === "POST") headers["Prefer"] = "return=minimal"
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) {
    const text = await res.text()
    console.error(`Supabase ${method} ${path} failed:`, text)
    return null
  }
  if (method === "GET") return await res.json()
  return true
}

async function searchTMDB(title: string, type: "movie" | "tv", year?: number) {
  const endpoint = type === "tv" ? "search/tv" : "search/movie"
  const url = `https://api.themoviedb.org/3/${endpoint}?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.results?.length) return null

  let best = data.results[0]
  for (const r of data.results) {
    const rTitle = (r.title || r.name || "").replace(/[^\w\s]/g, "").toLowerCase().trim()
    const q = title.replace(/[^\w\s]/g, "").toLowerCase().trim()
    if (rTitle === q) { best = r; break }
    const rYear = (r.release_date || r.first_air_date || "").slice(0, 4)
    if (year && rYear === String(year)) { best = r }
  }
  const yearVal = (best.release_date || best.first_air_date || "").slice(0, 4)
  return {
    tmdb_id: best.id,
    poster_path: best.poster_path,
    year: yearVal ? parseInt(yearVal) : null,
    title: type === "tv" ? best.name : best.title,
  }
}

async function updateEntry(userId: string, title: string, updates: { tmdb_id: number; title: string; poster_path: string | null; year: number | null; media_type: string }) {
  // Find existing entries by title
  const existing = await sf(`entries?user_id=eq.${userId}&title=eq.${encodeURIComponent(title)}&select=id,tmdb_id,media_type`, "GET")
  if (!existing || existing.length === 0) {
    console.log(`  Not found for update: ${title}`)
    return
  }
  for (const entry of existing) {
    const res = await sf(`entries?id=eq.${entry.id}`, "PATCH", updates)
    if (res) console.log(`  Updated: "${title}" → "${updates.title}" (${updates.year}, ${updates.media_type})`)
  }
}

async function main() {
  // Get user ID
  const uidData = await sf(`profiles?username=eq.rise&select=id`, "GET")
  if (!uidData?.[0]) { console.error("User not found"); return }
  const userId = uidData[0].id

  // Fix entries that got wrong TMDB matches (bad year = wrong movie)
  // Also fix wrong movie matches
  const movieFixes: Array<{ storedTitle: string; correctTitle: string; year: number }> = [
    { storedTitle: "Eclipse", correctTitle: "The Twilight Saga: Eclipse", year: 2010 },
    { storedTitle: "New Moon", correctTitle: "The Twilight Saga: New Moon", year: 2009 },
    { storedTitle: "Social Network", correctTitle: "The Social Network", year: 2010 },
  ]

  for (const fix of movieFixes) {
    console.log(`\nFixing: ${fix.storedTitle}`)
    const tmdb = await searchTMDB(fix.correctTitle, "movie", fix.year)
    if (!tmdb) { console.log(`  Could not find ${fix.correctTitle}`); continue }
    const existing = await sf(`entries?user_id=eq.${userId}&title=eq.${encodeURIComponent(fix.storedTitle)}&select=id`, "GET")
    if (!existing?.length) { console.log(`  Not found`); continue }
    for (const e of existing) {
      const res = await sf(`entries?id=eq.${e.id}`, "PATCH", {
        tmdb_id: tmdb.tmdb_id,
        title: tmdb.title,
        poster_path: tmdb.poster_path,
        year: tmdb.year,
      })
      if (res) console.log(`  Updated: "${fix.storedTitle}" → "${tmdb.title}" (${tmdb.year})`)
    }
  }

  const fixes: Array<{ originalTitle: string; storedTitle: string; year: number; type: "movie" | "tv" }> = [
    { originalTitle: "White Lotus", storedTitle: "The White Lotus", year: 2021, type: "tv" },
    { originalTitle: "The Rehearsal", storedTitle: "The Rehearsal", year: 2022, type: "tv" },
    { originalTitle: "The Pitt", storedTitle: "The Pitt", year: 2025, type: "tv" },
    { originalTitle: "The 100", storedTitle: "The 100", year: 2014, type: "tv" },
    { originalTitle: "Vampire Diaries", storedTitle: "The Vampire Diaries", year: 2009, type: "tv" },
    { originalTitle: "The Summer I Turned Pretty", storedTitle: "The Summer I Turned Pretty", year: 2022, type: "tv" },
    { originalTitle: "The Witcher", storedTitle: "The Witcher", year: 2019, type: "tv" },
    { originalTitle: "Queen's Gambit", storedTitle: "The Queen's Gambit", year: 2020, type: "tv" },
  ]

  for (const fix of fixes) {
    console.log(`\nFixing: ${fix.originalTitle}`)
    const tmdb = await searchTMDB(fix.storedTitle, fix.type, fix.year)
    if (!tmdb) { console.log(`  Could not find ${fix.storedTitle} on TMDB`); continue }
    await updateEntry(userId, fix.storedTitle, {
      tmdb_id: tmdb.tmdb_id,
      title: tmdb.title,
      poster_path: tmdb.poster_path,
      year: tmdb.year,
      media_type: "tv",
    })
  }

  // Import "Marvelous Mrs. Maisel" as TV show
  console.log(`\nTrying: Marvelous Mrs. Maisel (tv)`)
  const tmdb = await searchTMDB("The Marvelous Mrs. Maisel", "tv", 2017)
  if (tmdb) {
    const insertData = {
      user_id: userId,
      tmdb_id: tmdb.tmdb_id,
      media_type: "tv",
      title: tmdb.title,
      poster_path: tmdb.poster_path,
      year: tmdb.year,
      gut_rating: 96,
      gut_rated_at: new Date().toISOString(),
      notes: "",
      detailed_enjoyment: 60,
      detailed_impact: 18,
      detailed_recommend: 10,
      detailed_watch_again: 10,
      detailed_rated_at: new Date().toISOString(),
    }
    const res = await sf("entries", "POST", insertData)
    if (res) console.log(`  Imported: Marvelous Mrs. Maisel → "${tmdb.title}"`)
    else console.log(`  Failed or duplicate`)
  } else {
    console.log(`  Could not find on TMDB`)
  }

  console.log("\nDone!")
}

main().catch(console.error)
