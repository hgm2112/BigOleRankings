import dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

async function main() {
  const uidRes = await fetch(`${URL}/rest/v1/profiles?username=eq.rise&select=id`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  const uidData: any = await uidRes.json()
  const userId = uidData[0].id

  const res = await fetch(`${URL}/rest/v1/entries?user_id=eq.${userId}&select=id,media_type,gut_rating,detailed_enjoyment,year,title`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  const entries: any[] = await res.json()

  const movies = entries.filter((e) => e.media_type === "movie").length
  const tv = entries.filter((e) => e.media_type === "tv").length
  const misc = entries.filter((e) => e.media_type === "misc").length
  const withDetailed = entries.filter((e) => e.detailed_enjoyment !== null).length
  const without = entries.filter((e) => e.detailed_enjoyment === null)

  console.log("=== Final Import Summary ===")
  console.log("Total entries:", entries.length)
  console.log("Movies:", movies)
  console.log("TV Shows:", tv)
  console.log("Misc:", misc)
  console.log("With detailed ratings:", withDetailed)
  if (without.length > 0) {
    console.log("Missing detailed ratings:")
    for (const e of without) console.log(" -", e.title)
  } else {
    console.log("All entries have detailed ratings where applicable ✓")
  }
}

main().catch(console.error)
