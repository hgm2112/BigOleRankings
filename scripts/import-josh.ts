import * as fs from "fs"
import * as path from "path"
import * as readline from "readline"
import dotenv from "dotenv"
import * as XLSX from "xlsx"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN
const USERNAME = "bigolejosh"
const XLSX_PATH = path.resolve(__dirname, "../Josh's Ranking.xlsx")

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TMDB_ACCESS_TOKEN) {
  console.error("Missing required env vars")
  process.exit(1)
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
function ask(query: string): Promise<string> {
  return new Promise((resolve) => {
    if ((rl as any).closed) {
      console.log("(readline closed, defaulting to skip)")
      resolve("s")
      return
    }
    rl.question(query, resolve)
  })
}

function normalizeTitle(title: string): string {
  return title
    .replace(/^(The|A|An) /i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function normalizeTMDBApiTitle(title: string): string {
  return title.replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim().toLowerCase()
}

async function supabaseQuery(path: string, method: string, body?: any) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
    "Content-Type": "application/json",
  }
  if (method === "POST") {
    headers["Prefer"] = "return=minimal"
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    return { error: { message: text, code: String(res.status) }, data: null }
  }
  if (method === "GET") {
    return { error: null, data: await res.json() }
  }
  return { error: null, data: null }
}

async function getUserId(): Promise<string> {
  const { data, error } = await supabaseQuery(
    `profiles?username=eq.${USERNAME}&select=id`,
    "GET"
  )
  if (!error && data && data.length > 0) {
    console.log(`Found user: ${USERNAME} (${data[0].id})`)
    return data[0].id
  }
  console.error("Could not find user with username:", USERNAME)
  process.exit(1)
}

interface TMDBResult {
  tmdb_id: number
  title: string
  year: string
  poster_path: string | null
}

async function searchTMDB(title: string, type: string): Promise<TMDBResult[]> {
  const searchType = type === "misc" ? "movie" : type
  const endpoint = searchType === "tv" ? "search/tv" : "search/movie"
  const url = `https://api.themoviedb.org/3/${endpoint}?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}` },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`TMDB search failed for "${title}":`, text)
    return []
  }

  const data = await res.json()
  return (data.results || []).slice(0, 5).map((item: any) => ({
    tmdb_id: item.id,
    title: searchType === "tv" ? item.name : item.title,
    year: (item.release_date || item.first_air_date || "").slice(0, 4),
    poster_path: item.poster_path,
  }))
}

function titleMatches(inputTitle: string, resultTitle: string): boolean {
  return normalizeTitle(inputTitle) === normalizeTMDBApiTitle(resultTitle)
}

interface RowData {
  name: string
  sourceType: string
  gutRating: number
  enjoyment: number
  impact: number
  recommend: number
  watchAgain: number
}

function readExcel(): RowData[] {
  const buf = fs.readFileSync(XLSX_PATH)
  const workbook = XLSX.read(buf, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 })

  const data: RowData[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0]) continue
    const name = String(row[0]).trim()
    if (!name) continue

    const sourceType = String(row[1] || "").trim()
    let mediaType: string
    if (sourceType.toLowerCase() === "tv show") {
      mediaType = "tv"
    } else if (sourceType.toLowerCase() === "misc") {
      mediaType = "misc"
    } else {
      mediaType = "movie"
    }

    data.push({
      name,
      sourceType: mediaType,
      gutRating: parseInt(row[2]) || 0,
      enjoyment: parseInt(row[3]) || 0,
      impact: parseInt(row[4]) || 0,
      recommend: parseInt(row[5]) || 0,
      watchAgain: parseInt(row[6]) || 0,
    })
  }

  return data
}

async function insertEntry(userId: string, entry: RowData, tmdb: TMDBResult | null) {
  const insertData: Record<string, any> = {
    user_id: userId,
    tmdb_id: tmdb?.tmdb_id ?? 0,
    media_type: entry.sourceType,
    title: tmdb?.title ?? entry.name,
    poster_path: tmdb?.poster_path ?? null,
    year: tmdb?.year ? parseInt(tmdb.year) : null,
    gut_rating: entry.gutRating,
    gut_rated_at: new Date().toISOString(),
    notes: "",
    detailed_enjoyment: entry.enjoyment,
    detailed_impact: entry.impact,
    detailed_recommend: entry.recommend,
    detailed_watch_again: entry.watchAgain,
    detailed_rated_at: entry.enjoyment > 0 || entry.impact > 0 || entry.recommend > 0 || entry.watchAgain > 0
      ? new Date().toISOString()
      : null,
  }

  const { error } = await supabaseQuery("entries", "POST", insertData)
  if (error) {
    if (error.code === "409" && error.message.includes("duplicate")) {
      console.log(`  Already exists, skipping`)
      return "skipped"
    }
    console.error(`  Insert failed:`, error.message)
    return "failed"
  }
  return "imported"
}

async function main() {
  console.log("=== BigOleRankings Import Script for bigolejosh ===\n")

  const userId = await getUserId()
  const entries = readExcel()
  console.log(`Read ${entries.length} entries from spreadsheet\n`)

  let imported = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    console.log(`\n[${i + 1}/${entries.length}] ${entry.name} (${entry.sourceType})`)

    if (entry.gutRating < 1 || entry.gutRating > 100) {
      console.log(`  Skipping - invalid gut rating: ${entry.gutRating}`)
      skipped++
      continue
    }

    let results: TMDBResult[] = []
    try {
      results = await searchTMDB(entry.name, entry.sourceType)
    } catch (e) {
      console.log(`  TMDB search error:`, e)
    }

    if (results.length === 0) {
      console.log(`  No TMDB results found for "${entry.name}"`)

      const answer = await ask(`  Insert without TMDB link? (y/n): `)
      if (answer.toLowerCase() !== "y") {
        console.log("  Skipping")
        skipped++
        continue
      }

      const result = await insertEntry(userId, entry, null)
      if (result === "imported") {
        console.log("  Imported (without TMDB link)")
        imported++
      } else if (result === "skipped") {
        skipped++
      } else {
        failed++
      }
      continue
    }

    let selected: TMDBResult | null = null

    const exactMatch = results.find((r) => titleMatches(entry.name, r.title))
    if (exactMatch && results.length === 1) {
      selected = exactMatch
      console.log(`  Auto-matched: "${exactMatch.title}" (${exactMatch.year})`)
    } else if (exactMatch) {
      selected = exactMatch
      console.log(`  Auto-matched: "${exactMatch.title}" (${exactMatch.year})`)
      console.log(`  (Also found: ${results.filter((r) => r !== exactMatch).map((r) => `"${r.title}"`).join(", ")})`)
    } else {
      console.log("  Select the correct match:")
      for (let j = 0; j < results.length; j++) {
        console.log(`    ${j + 1}) "${results[j].title}" (${results[j].year})`)
      }
      console.log(`    s) Skip this entry`)
      console.log(`    n) Insert without TMDB link`)

      const answer = await ask(`  Choice (1-${results.length}/s/n): `)

      if (answer.toLowerCase() === "s") {
        console.log("  Skipping")
        skipped++
        continue
      }

      if (answer.toLowerCase() === "n") {
        const result = await insertEntry(userId, entry, null)
        if (result === "imported") {
          console.log("  Imported (without TMDB link)")
          imported++
        } else if (result === "skipped") {
          skipped++
        } else {
          failed++
        }
        continue
      }

      const choice = parseInt(answer)
      if (isNaN(choice) || choice < 1 || choice > results.length) {
        console.log("  Invalid choice, skipping")
        skipped++
        continue
      }

      selected = results[choice - 1]
    }

    const result = await insertEntry(userId, entry, selected)
    if (result === "imported") {
      console.log(`  Imported: "${selected.title}" (${selected.year})`)
      imported++
    } else if (result === "skipped") {
      skipped++
    } else {
      failed++
    }
  }

  console.log(`\n=== Import Complete ===`)
  console.log(`  Imported: ${imported}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)

  rl.close()
}

main().catch((err) => {
  console.error("Fatal error:", err)
  if (!(rl as any).closed) rl.close()
  process.exit(1)
})
