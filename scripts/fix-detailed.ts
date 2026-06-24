import dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve("/home/hgm2112/projects/BigOleRankings/big-ole-rankings/.env.local") })

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

async function main() {
  const uidRes = await fetch(`${URL}/rest/v1/profiles?username=eq.rise&select=id`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  const uidData = await uidRes.json()
  const userId = uidData[0].id
  console.log("userId:", userId)

  const now = new Date().toISOString()
  const map: Record<string, any> = {
    Hamilton: { detailed_enjoyment: 60, detailed_impact: 20, detailed_recommend: 10, detailed_watch_again: 10, detailed_rated_at: now },
    "Lessons in Chemistry": { detailed_enjoyment: 60, detailed_impact: 18, detailed_recommend: 10, detailed_watch_again: 10, detailed_rated_at: now },
    Prisoners: { detailed_enjoyment: 58, detailed_impact: 12, detailed_recommend: 10, detailed_watch_again: 8, detailed_rated_at: now },
    Parasite: { detailed_enjoyment: 51, detailed_impact: 18, detailed_recommend: 9, detailed_watch_again: 7, detailed_rated_at: now },
  }

  for (const [title, data] of Object.entries(map)) {
    const res = await fetch(`${URL}/rest/v1/entries?user_id=eq.${userId}&title=eq.${encodeURIComponent(title)}&select=id`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    })
    const entries = await res.json()
    if (!entries?.length) {
      console.log("Not found:", title)
      continue
    }
    for (const e of entries) {
      const r = await fetch(`${URL}/rest/v1/entries?id=eq.${e.id}`, {
        method: "PATCH",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      console.log(title, r.ok ? "OK" : "FAIL", await r.text().catch(() => ""))
    }
  }
}

main().catch(console.error)
