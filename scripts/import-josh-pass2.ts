import * as fs from "fs"
import * as path from "path"
import dotenv from "dotenv"
import * as XLSX from "xlsx"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN
const USERNAME = "bigolejosh"
const XLSX_PATH = path.resolve(__dirname, "../Josh's Ranking.xlsx")

if (!SUPABASE_URL || !SUPABASE_KEY || !TMDB_TOKEN) {
  console.error("Missing required env vars")
  process.exit(1)
}

async function supabaseFetch(path: string, method: string, body?: any) {
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

// Entries skipped from pass1 (no auto-match, readline closed)
const MANUAL_MATCHES: Record<string, { title: string; year?: number }> = {
  "Avengers: End Game": { title: "Avengers: Endgame", year: 2019 },
  "Taylor Swift Eras Tour": { title: "TAYLOR SWIFT | THE ERAS TOUR", year: 2023 },
  "Taylor Swift Long Pond Sessions": { title: "Folklore: The Long Pond Studio Sessions", year: 2020 },
  "Breaking Dawn Pt 2": { title: "The Twilight Saga: Breaking Dawn - Part 2", year: 2012 },
  "Breaking Dawn Pt 1": { title: "The Twilight Saga: Breaking Dawn - Part 1", year: 2011 },
  "The 100": { title: "The 100", year: 2014 },
  "The Rehearsal": { title: "The Rehearsal", year: 2022 },
  "Taylor Swift Miss Amercana": { title: "Taylor Swift: Miss Americana", year: 2020 },
  "Taylor Swift The End of an Era": { title: "The End of an Era", year: 2025 },
  "Queen's Gambit": { title: "The Queen's Gambit", year: 2020 },
  "Nice Guys": { title: "The Nice Guys", year: 2016 },
  "Thor Ragnorok": { title: "Thor: Ragnarok", year: 2017 },
  "Taylor Swift Reputation Tour": { title: "Taylor Swift: Reputation Stadium Tour", year: 2018 },
  "Avengers": { title: "The Avengers", year: 2012 },
  "The Pitt": { title: "The Pitt", year: 2025 },
  "Martian": { title: "The Martian", year: 2015 },
  "Fault In Our Stars": { title: "The Fault in Our Stars", year: 2014 },
  "Greatest Showman": { title: "The Greatest Showman", year: 2017 },
  "The Impossible": { title: "The Impossible", year: 2012 },
  "Age of Ultron": { title: "Avengers: Age of Ultron", year: 2015 },
  "Captain America: Winter Soldier": { title: "Captain America: The Winter Soldier", year: 2014 },
  "Dr. Strange MoM": { title: "Doctor Strange in the Multiverse of Madness", year: 2022 },
  "The Witcher": { title: "The Witcher", year: 2019 },
  "A Monster Calls": { title: "A Monster Calls", year: 2016 },
  "White Lotus": { title: "The White Lotus", year: 2021 },
  "High School Musical 3": { title: "High School Musical 3: Senior Year", year: 2008 },
  "Christmas Vacation": { title: "National Lampoon's Christmas Vacation", year: 1989 },
  "Cabin in the Woods": { title: "The Cabin in the Woods", year: 2012 },
  "A Quiet Place": { title: "A Quiet Place", year: 2018 },
  "The Age of Adaline": { title: "The Age of Adaline", year: 2015 },
  "The Descent": { title: "The Descent", year: 2005 },
  "Next Three Days": { title: "The Next Three Days", year: 2010 },
  "Time Traveler's Wife": { title: "The Time Traveler's Wife", year: 2009 },
  "The Man from U.N.C.L.E.": { title: "The Man from U.N.C.L.E.", year: 2015 },
  "Vampire Diaries": { title: "The Vampire Diaries", year: 2009 },
  "Marvelous Mrs. Maisel": { title: "The Marvelous Mrs. Maisel", year: 2017 },
  "Simple Favor": { title: "A Simple Favor", year: 2018 },
  "Zombieland 2": { title: "Zombieland: Double Tap", year: 2019 },
  "The Substance": { title: "The Substance", year: 2024 },
  "High School Musical 1": { title: "High School Musical", year: 2006 },
  "Grand Budapest Hotel": { title: "The Grand Budapest Hotel", year: 2014 },
  "The Summer I Turned Pretty": { title: "The Summer I Turned Pretty", year: 2022 },
  "DaVinci Code": { title: "The Da Vinci Code", year: 2006 },
  "Witch": { title: "The Witch", year: 2016 },
  "The Shining": { title: "The Shining", year: 1980 },
  "The Drama": { title: "The Drama", year: 2026 },
}

// Wrong auto-matches from pass1 — delete old entry and re-insert with correct TMDB data
const WRONG_MATCHES: Record<string, { title: string; year?: number }> = {
  "Hamilton": { title: "Hamilton", year: 2020 },
  "Social Network": { title: "The Social Network", year: 2010 },
  "Eclipse": { title: "The Twilight Saga: Eclipse", year: 2010 },
  "New Moon": { title: "The Twilight Saga: New Moon", year: 2009 },
  "Edge of Seventeen": { title: "The Edge of Seventeen", year: 2016 },
  "Revenant": { title: "The Revenant", year: 2015 },
  "Black Bird": { title: "Black Bird", year: 2022 },
}

function normalize(str: string) {
  return str.replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim().toLowerCase()
}

async function searchTMDB(title: string, type: string) {
  const searchType = type === "misc" || type === "movie" ? "movie" : "tv"
  const endpoint = searchType === "tv" ? "search/tv" : "search/movie"
  const url = `https://api.themoviedb.org/3/${endpoint}?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } })
  if (!res.ok) return null
  const data = await res.json()
  return (data.results || []).map((r: any) => ({
    tmdb_id: r.id,
    title: searchType === "tv" ? r.name : r.title,
    year: (r.release_date || r.first_air_date || "").slice(0, 4),
    poster_path: r.poster_path,
  }))
}

function readExcel(): Record<string, { gutRating: number; enjoyment: number; impact: number; recommend: number; watchAgain: number; sourceType: string }> {
  const buf = fs.readFileSync(XLSX_PATH)
  const workbook = XLSX.read(buf, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 })
  const result: Record<string, any> = {}
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0]) continue
    const name = String(row[0]).trim()
    if (!name) continue
    const sourceType = String(row[1] || "").trim()
    let mediaType = "movie"
    if (sourceType.toLowerCase() === "tv show") mediaType = "tv"
    else if (sourceType.toLowerCase() === "misc") mediaType = "misc"
    result[name] = {
      gutRating: parseInt(row[2]) || 0,
      enjoyment: parseInt(row[3]) || 0,
      impact: parseInt(row[4]) || 0,
      recommend: parseInt(row[5]) || 0,
      watchAgain: parseInt(row[6]) || 0,
      sourceType: mediaType,
    }
  }
  return result
}

async function deleteEntry(userId: string, title: string) {
  const { data: existing } = await supabaseFetch(
    `entries?user_id=eq.${userId}&title=eq.${encodeURIComponent(title)}&select=id`,
    "GET"
  )
  if (existing && existing.length > 0) {
    console.log(`  Deleting old entry: "${existing[0].id}"`)
    await supabaseFetch(`entries?id=eq.${existing[0].id}`, "DELETE")
  }
}

async function insertEntry(userId: string, excelName: string, allRows: Record<string, any>) {
  const row = allRows[excelName]
  if (!row) { console.log(`  No spreadsheet data for "${excelName}"`); return "skipped" }

  const matchInfo = MANUAL_MATCHES[excelName] || WRONG_MATCHES[excelName]
  if (!matchInfo) { console.log(`  No match info for "${excelName}"`); return "skipped" }

  // For wrong matches, delete the old entry first
  if (WRONG_MATCHES[excelName]) {
    await deleteEntry(userId, excelName)
  }

  console.log(`  Searching TMDB for "${matchInfo.title}" (${matchInfo.year || "?"})`)
  const results = await searchTMDB(matchInfo.title, row.sourceType)
  if (!results || results.length === 0) {
    console.log(`  No TMDB results`)
    return "skipped"
  }

  let selected = results[0]
  if (results.length > 1) {
    const exact = results.find((r: any) => normalize(r.title) === normalize(matchInfo.title))
    if (exact) selected = exact
    else console.log(`  Multiple results, using first: "${selected.title}" (${selected.year})`)
  }

  const hasDetail = row.enjoyment > 0 || row.impact > 0 || row.recommend > 0 || row.watchAgain > 0

  const { error } = await supabaseFetch("entries", "POST", {
    user_id: userId,
    tmdb_id: selected.tmdb_id,
    media_type: row.sourceType,
    title: selected.title,
    poster_path: selected.poster_path,
    year: selected.year ? parseInt(selected.year) : null,
    gut_rating: row.gutRating,
    gut_rated_at: new Date().toISOString(),
    notes: "",
    detailed_enjoyment: row.enjoyment,
    detailed_impact: row.impact,
    detailed_recommend: row.recommend,
    detailed_watch_again: row.watchAgain,
    detailed_rated_at: hasDetail ? new Date().toISOString() : null,
  })

  if (error) {
    if (error.code === "409") { console.log(`  Already exists`); return "skipped" }
    console.error(`  Failed:`, error.message)
    return "failed"
  }
  console.log(`  Imported: "${selected.title}" (${selected.year})`)
  return "imported"
}

async function main() {
  console.log("=== Josh Import Pass 2 ===\n")

  const { data: users } = await supabaseFetch(`profiles?username=eq.${USERNAME}&select=id`, "GET")
  const userId = users?.[0]?.id
  if (!userId) { console.error("User not found"); process.exit(1) }
  console.log("User ID:", userId)

  const allRows = readExcel()
  console.log(`Read ${Object.keys(allRows).length} rows from spreadsheet\n`)

  // Fix Black Bird media_type to tv (it's an Apple TV+ series)
  if (allRows["Black Bird"]) allRows["Black Bird"].sourceType = "tv"

  let imported = 0, skipped = 0, failed = 0

  // Phase 1: Fix wrong auto-matches
  console.log("--- Phase 1: Fix wrong auto-matches ---")
  for (const name of Object.keys(WRONG_MATCHES)) {
    process.stdout.write(`\n[${name}] `)
    const result = await insertEntry(userId, name, allRows)
    if (result === "imported") imported++
    else if (result === "skipped") skipped++
    else failed++
  }

  // Phase 2: Import skipped entries
  console.log("\n\n--- Phase 2: Import skipped entries ---")
  for (const name of Object.keys(MANUAL_MATCHES)) {
    process.stdout.write(`\n[${name}] `)
    const result = await insertEntry(userId, name, allRows)
    if (result === "imported") imported++
    else if (result === "skipped") skipped++
    else failed++
  }

  console.log(`\n\n=== Pass 2 Complete ===`)
  console.log(`  Imported: ${imported}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)
}

main().catch(console.error)
