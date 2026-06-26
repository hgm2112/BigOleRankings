import dotenv from "dotenv"
import * as path from "path"
import * as XLSX from "xlsx"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN
const USERNAME = "Iluvhilly"
const XLSX_PATH = path.resolve(__dirname, "../Cutter Rankings.xlsx")

if (!SUPABASE_URL || !SUPABASE_KEY || !TMDB_TOKEN) {
  console.error("Missing required env vars")
  process.exit(1)
}

async function sf(path: string, method: string, body?: any) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY!,
    Authorization: `Bearer ${SUPABASE_KEY!}`,
    "Content-Type": "application/json",
  }
  if (method === "POST") headers["Prefer"] = "return=minimal"
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) {
    const text = await res.text()
    return { error: { message: text, code: String(res.status) }, data: null }
  }
  if (method === "GET") return { error: null, data: await res.json() }
  return { error: null, data: null }
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
  return {
    tmdb_id: best.id,
    poster_path: best.poster_path,
    year: (best.release_date || best.first_air_date || "").slice(0, 4) ? parseInt((best.release_date || best.first_air_date || "").slice(0, 4)) : null,
    title: type === "tv" ? best.name : best.title,
  }
}

// Manual matches for entries skipped in pass 1
const MANUAL_MATCHES: Record<string, { title: string; year: number }> = {
  "The Office": { title: "The Office", year: 2005 },
  "The Queen's Gambit": { title: "The Queen's Gambit", year: 2020 },
  "Park and Rec": { title: "Parks and Recreation", year: 2009 },
  "The Good Place": { title: "The Good Place", year: 2016 },
  "Brooklyn 99": { title: "Brooklyn Nine-Nine", year: 2013 },
  "White Lotus": { title: "The White Lotus", year: 2021 },
  "The Witcher": { title: "The Witcher", year: 2019 },
  "Crazy Ex Girlfriend": { title: "Crazy Ex-Girlfriend", year: 2015 },
  "Broad Church": { title: "Broadchurch", year: 2013 },
  "Malcom in the Middle": { title: "Malcolm in the Middle", year: 2000 },
  "The Big Bang Theory": { title: "The Big Bang Theory", year: 2007 },
  "The 100": { title: "The 100", year: 2014 },
}

function readExcel(): Record<string, { gutRating: number; enjoyment: number; impact: number; recommend: number; watchAgain: number }> {
  const buf = require("fs").readFileSync(XLSX_PATH)
  const workbook = XLSX.read(buf, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 })
  const result: Record<string, any> = {}
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0]) continue
    const name = String(row[0]).trim()
    if (!name) continue
    result[name] = {
      gutRating: parseInt(row[1]) || 0,
      enjoyment: parseInt(row[2]) || 0,
      impact: parseInt(row[3]) || 0,
      recommend: parseInt(row[4]) || 0,
      watchAgain: parseInt(row[5]) || 0,
    }
  }
  return result
}

async function main() {
  console.log("=== Cutter Rankings Pass 2 ===\n")

  const uidRes = await sf(`profiles?username=eq.${USERNAME}&select=id`, "GET")
  const userId = uidRes.data?.[0]?.id
  if (!userId) { console.error("User not found"); process.exit(1) }
  console.log("User ID:", userId)

  const allRows = readExcel()
  console.log(`Read ${Object.keys(allRows).length} rows from spreadsheet\n`)

  let imported = 0, skipped = 0, failed = 0

  for (const [excelName, match] of Object.entries(MANUAL_MATCHES)) {
    process.stdout.write(`\n[${excelName}] `)

    const row = allRows[excelName]
    if (!row) { console.log("No spreadsheet data"); skipped++; continue }

    const tmdb = await searchTMDB(match.title, "tv", match.year)
    if (!tmdb) { console.log(`Could not find "${match.title}" on TMDB`); skipped++; continue }

    const hasDetail = row.enjoyment > 0 || row.impact > 0 || row.recommend > 0 || row.watchAgain > 0

    const result = await sf("entries", "POST", {
      user_id: userId,
      tmdb_id: tmdb.tmdb_id,
      media_type: "tv",
      title: tmdb.title,
      poster_path: tmdb.poster_path,
      year: tmdb.year,
      gut_rating: row.gutRating,
      gut_rated_at: new Date().toISOString(),
      notes: "",
      detailed_enjoyment: row.enjoyment,
      detailed_impact: row.impact,
      detailed_recommend: row.recommend,
      detailed_watch_again: row.watchAgain,
      detailed_rated_at: hasDetail ? new Date().toISOString() : null,
    })

    if (result.error) {
      if (result.error.message.includes("duplicate")) {
        console.log(`Already exists, skipping`)
        skipped++
      } else {
        console.error(`Failed: ${result.error.message}`)
        failed++
      }
    } else {
      console.log(`Imported: "${tmdb.title}" (${tmdb.year})`)
      imported++
    }
  }

  console.log(`\n=== Pass 2 Complete ===`)
  console.log(`  Imported: ${imported}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)
}

main().catch(console.error)
