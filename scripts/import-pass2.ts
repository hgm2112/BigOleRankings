import * as fs from "fs"
import * as path from "path"
import dotenv from "dotenv"
import * as XLSX from "xlsx"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN
const USERNAME = "rise"
const XLSX_PATH = path.resolve(__dirname, "../Hill's Ranking.xlsx")

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

// Hardcoded correct TMDB matches for titles that needed user input
const MANUAL_MATCHES: Record<string, { title: string; year?: number; tmdb_id?: number }> = {
  "Avengers": { title: "The Avengers", year: 2012 },
  "Avengers: End Game": { title: "Avengers: Endgame", year: 2019 },
  "Queen's Gambit": { title: "The Queen's Gambit", year: 2020 },
  "Breaking Dawn Pt 2": { title: "The Twilight Saga: Breaking Dawn - Part 2", year: 2012 },
  "Breaking Dawn Pt 1": { title: "The Twilight Saga: Breaking Dawn - Part 1", year: 2011 },
  "Thor Ragnorok": { title: "Thor: Ragnarok", year: 2017 },
  "Taylor Swift Eras Tour": { title: "TAYLOR SWIFT | THE ERAS TOUR", year: 2023 },
  "Taylor Swift Long Pond Sessions": { title: "Folklore: The Long Pond Studio Sessions", year: 2020 },
  "Taylor Swift Miss Amercana": { title: "Taylor Swift: Miss Americana", year: 2020 },
  "Taylor Swift Reputation Tour": { title: "Taylor Swift: Reputation Stadium Tour", year: 2018 },
  "Taylor Swift The End of an Era": { title: "Taylor Swift: The Eras Tour", year: 2023 },
  "The Pitt": { title: "The Pitt", year: 2025 },
  "Cabin in the Woods": { title: "The Cabin in the Woods", year: 2012 },
  "Greatest Showman": { title: "The Greatest Showman", year: 2017 },
  "Martian": { title: "The Martian", year: 2015 },
  "A Monster Calls": { title: "A Monster Calls", year: 2016 },
  "White Lotus": { title: "The White Lotus", year: 2021 },
  "Nice Guys": { title: "The Nice Guys", year: 2016 },
  "The Rehearsal": { title: "The Rehearsal", year: 2022 },
  "The 100": { title: "The 100", year: 2014 },
  "The Impossible": { title: "The Impossible", year: 2012 },
  "Age of Ultron": { title: "Avengers: Age of Ultron", year: 2015 },
  "A Quiet Place": { title: "A Quiet Place", year: 2018 },
  "Fault In Our Stars": { title: "The Fault in Our Stars", year: 2014 },
  "Captain America: Winter Soldier": { title: "Captain America: The Winter Soldier", year: 2014 },
  "Dr. Strange MoM": { title: "Doctor Strange in the Multiverse of Madness", year: 2022 },
  "The Substance": { title: "The Substance", year: 2024 },
  "Time Traveler's Wife": { title: "The Time Traveler's Wife", year: 2009 },
  "High School Musical 3": { title: "High School Musical 3: Senior Year", year: 2008 },
  "Christmas Vacation": { title: "National Lampoon's Christmas Vacation", year: 1989 },
  "Marvelous Mrs. Maisel": { title: "The Marvelous Mrs. Maisel", year: 2017 },
  "Simple Favor": { title: "A Simple Favor", year: 2018 },
  "Zombieland 2": { title: "Zombieland: Double Tap", year: 2019 },
  "High School Musical 1": { title: "High School Musical", year: 2006 },
  "The Man from U.N.C.L.E.": { title: "The Man from U.N.C.L.E.", year: 2015 },
  "The Age of Adaline": { title: "The Age of Adaline", year: 2015 },
  "May November": { title: "May December", year: 2023 },
  "Next Three Days": { title: "The Next Three Days", year: 2010 },
  "Grand Budapest Hotel": { title: "The Grand Budapest Hotel", year: 2014 },
  "Witch": { title: "The Witch", year: 2015 },
  "Vampire Diaries": { title: "The Vampire Diaries", year: 2009 },
  "DaVinci Code": { title: "The Da Vinci Code", year: 2006 },
  "The Summer I Turned Pretty": { title: "The Summer I Turned Pretty", year: 2022 },
  "The Shining": { title: "The Shining", year: 1980 },
  "The Witcher": { title: "The Witcher", year: 2019 },
  "The Drama": { title: "The Drama", year: 2026 },
  "The Descent": { title: "The Descent", year: 2005 },
}

// Skip these - already in database (confirmed duplicates from pass 1)
const SKIP_TITLES = new Set([
  "Spider-Man No Way Home",
  "Hamilton",
  "Lessons in Chemistry",
  "Adventureland",
  "Prisoners",
  "Parasite",
  "12 Monkeys",
  "Spider-Man Homecoming",
])

async function searchTMDB(title: string, year?: number): Promise<{ tmdb_id: number; poster_path: string | null; year: number | null } | null> {
  const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.results?.length) return null

  // Prefer exact title match
  const normalized = title.replace(/[^\w\s]/g, "").toLowerCase().trim()
  let best = data.results[0]
  for (const r of data.results) {
    const rTitle = (r.title || "").replace(/[^\w\s]/g, "").toLowerCase().trim()
    if (rTitle === normalized || (year && r.release_date?.startsWith(String(year)))) {
      best = r
      break
    }
  }
  return {
    tmdb_id: best.id,
    poster_path: best.poster_path,
    year: (best.release_date || "").slice(0, 4) ? parseInt((best.release_date || "").slice(0, 4)) : null,
  }
}

async function main() {
  // Get user ID
  const uidRes = await supabaseFetch(`profiles?username=eq.${USERNAME}&select=id`, "GET")
  if (!uidRes.data?.[0]) {
    console.error("Could not find user")
    process.exit(1)
  }
  const userId = uidRes.data[0].id
  console.log("User ID:", userId)

  // Read all entries from Excel
  const buf = fs.readFileSync(XLSX_PATH)
  const workbook = XLSX.read(buf, { type: "buffer" })
  const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 })

  let imported = 0, skipped = 0, failed = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0]) continue
    const name = String(row[0]).trim()
    if (!name) continue
    if (SKIP_TITLES.has(name)) continue

    const sourceType = String(row[1] || "").trim()
    let mediaType: string
    if (sourceType.toLowerCase() === "tv show") mediaType = "tv"
    else if (sourceType.toLowerCase() === "misc") mediaType = "misc"
    else mediaType = "movie"

    const gutRating = parseInt(row[2]) || 0
    const enjoyment = parseInt(row[3]) || 0
    const impact = parseInt(row[4]) || 0
    const recommend = parseInt(row[5]) || 0
    const watchAgain = parseInt(row[6]) || 0

    // Check if already imported
    const existing = await supabaseFetch(
      `entries?user_id=eq.${userId}&title=eq.${encodeURIComponent(name)}&select=id`,
      "GET"
    )
    if (existing.data && existing.data.length > 0) {
      continue
    }

    const match = MANUAL_MATCHES[name]
    if (!match) continue

    const tmdb = await searchTMDB(match.title, match.year)
    if (!tmdb) {
      console.log(`No TMDB match for "${name}" → "${match.title}"`)
      skipped++
      continue
    }

    const insertData: Record<string, any> = {
      user_id: userId,
      tmdb_id: tmdb.tmdb_id,
      media_type: mediaType,
      title: match.title,
      poster_path: tmdb.poster_path,
      year: tmdb.year,
      gut_rating: gutRating,
      gut_rated_at: new Date().toISOString(),
      notes: "",
      detailed_enjoyment: enjoyment,
      detailed_impact: impact,
      detailed_recommend: recommend,
      detailed_watch_again: watchAgain,
      detailed_rated_at: new Date().toISOString(),
    }

    const result = await supabaseFetch("entries", "POST", insertData)
    if (result.error) {
      if (result.error.message.includes("duplicate")) {
        console.log(`  Skip (duplicate): ${name}`)
        skipped++
      } else {
        console.error(`  Failed: ${name} - ${result.error.message}`)
        failed++
      }
    } else {
      console.log(`  Imported: ${name} → "${match.title}" (${tmdb.year})`)
      imported++
    }
  }

  console.log(`\nSecond pass complete: ${imported} imported, ${skipped} skipped, ${failed} failed`)
}

main().catch(console.error)
