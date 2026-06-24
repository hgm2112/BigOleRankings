"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RankingList } from "@/components/ranking-list"
import { Search, TrendingUp, TrendingDown, Users } from "lucide-react"

interface Profile {
  id: string
  username: string | null
  display_name: string | null
}

interface Entry {
  id: string
  tmdb_id: number
  title: string
  media_type: string
  poster_path: string | null
  year: number | null
  gut_rating: number | null
  detailed_enjoyment: number | null
  detailed_impact: number | null
  detailed_recommend: number | null
  detailed_watch_again: number | null
  user_id: string
}

export default function ComparePage() {
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [user1, setUser1] = useState<Profile | null>(null)
  const [user2, setUser2] = useState<Profile | null>(null)
  const [entries1, setEntries1] = useState<Entry[]>([])
  const [entries2, setEntries2] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!searchQuery.trim()) return
    setLoading(true)
    setSearched(true)

    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .ilike("username", `%${searchQuery}%`)
      .limit(10)

    setSearchResults(data || [])
    setLoading(false)
  }

  const selectUser = async (profile: Profile, slot: 1 | 2) => {
    if (slot === 1) {
      setUser1(profile)
      const { data } = await supabase.from("entries").select("*").eq("user_id", profile.id).not("gut_rating", "is", null)
      setEntries1(data || [])
    } else {
      setUser2(profile)
      const { data } = await supabase.from("entries").select("*").eq("user_id", profile.id).not("gut_rating", "is", null)
      setEntries2(data || [])
    }
    setSearchResults([])
    setSearchQuery("")
  }

  const intersection = (() => {
    if (!user1 || !user2) return []
    const map2 = new Map(entries2.map((e) => [`${e.tmdb_id}-${e.media_type}`, e]))
    const result: Array<{ entry: Entry; user2Entry: Entry }> = []

    for (const e1 of entries1) {
      const key = `${(e1 as any).tmdb_id}-${e1.media_type}`
      const e2 = map2.get(key)
      if (e2) {
        result.push({ entry: e1, user2Entry: e2 })
      }
    }

    return result
  })()

  const avgEntries = intersection.map(({ entry, user2Entry }) => {
    const gutAvg = entry.gut_rating && user2Entry.gut_rating
      ? Math.round((entry.gut_rating + user2Entry.gut_rating) / 2)
      : (entry.gut_rating || user2Entry.gut_rating || 0)

    const calcDet = (e: Entry) => e.detailed_enjoyment !== null
      ? (e.detailed_enjoyment ?? 0) + (e.detailed_impact ?? 0) + (e.detailed_recommend ?? 0) + (e.detailed_watch_again ?? 0)
      : 0

    const det1 = calcDet(entry)
    const det2 = calcDet(user2Entry)

    const hasDetailed = entry.detailed_enjoyment !== null && user2Entry.detailed_enjoyment !== null
    const detAvg = hasDetailed ? Math.round((det1 + det2) / 2) : 0

    return {
      id: entry.id,
      title: entry.title,
      media_type: entry.media_type,
      poster_path: entry.poster_path,
      year: entry.year,
      gut_rating: gutAvg,
      score: hasDetailed ? detAvg : gutAvg,
    }
  })

  const movies = avgEntries.filter((e) => e.media_type === "movie")
  const tvShows = avgEntries.filter((e) => e.media_type === "tv")
  const misc = avgEntries.filter((e) => e.media_type === "misc")

  const top = (list: typeof avgEntries) => [...list].sort((a, b) => b.score - a.score).slice(0, 10)
  const worst = (list: typeof avgEntries) => [...list].sort((a, b) => a.score - b.score).slice(0, 10)

  const detailedTotal = (e: Entry) =>
    e.detailed_enjoyment !== null
      ? (e.detailed_enjoyment ?? 0) + (e.detailed_impact ?? 0) + (e.detailed_recommend ?? 0) + (e.detailed_watch_again ?? 0)
      : null

  const diff = (a: number | null, b: number | null) => {
    if (a === null || b === null) return null
    return a - b
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compare Users</h1>
        <p className="text-muted-foreground">Compare ratings side by side with another user</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">User 1</CardTitle>
          </CardHeader>
          <CardContent>
            {user1 ? (
              <div className="flex items-center gap-2 mb-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{(user1.display_name || user1.username || "U").charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{user1.display_name || user1.username}</span>
                <Button variant="ghost" size="sm" onClick={() => { setUser1(null); setEntries1([]) }}>Change</Button>
              </div>
            ) : null}
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input placeholder="Search by username..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <Button type="submit" size="sm" disabled={loading || !searchQuery.trim()}>
                <Search className="h-4 w-4" />
              </Button>
            </form>
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {searchResults.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{(p.display_name || p.username || "U").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{p.display_name || p.username}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => selectUser(p, 1)} disabled={user2?.id === p.id}>User 1</Button>
                      <Button size="sm" variant="outline" onClick={() => selectUser(p, 2)} disabled={user1?.id === p.id}>User 2</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searched && searchResults.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground mt-2">No users found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">User 2</CardTitle>
          </CardHeader>
          <CardContent>
            {user2 ? (
              <div className="flex items-center gap-2 mb-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{(user2.display_name || user2.username || "U").charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{user2.display_name || user2.username}</span>
                <Button variant="ghost" size="sm" onClick={() => { setUser2(null); setEntries2([]) }}>Change</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select User 1 first, then search for User 2.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {user1 && user2 && intersection.length > 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Side-by-Side Comparison ({intersection.length} shared entries)
              </CardTitle>
              <CardDescription>
                {user1.display_name || user1.username} vs {user2.display_name || user2.username}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4">Title</th>
                      <th className="text-center py-2 px-2">{user1.display_name || user1.username} Gut</th>
                      <th className="text-center py-2 px-2">{user2.display_name || user2.username} Gut</th>
                      <th className="text-center py-2 px-2">Δ Gut</th>
                      <th className="text-center py-2 px-2">{user1.display_name || user1.username} Det</th>
                      <th className="text-center py-2 px-2">{user2.display_name || user2.username} Det</th>
                      <th className="text-center py-2 pl-2">Δ Det</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intersection.map(({ entry, user2Entry }) => {
                      const det1 = detailedTotal(entry)
                      const det2 = detailedTotal(user2Entry)
                      const gutDiff = diff(entry.gut_rating, user2Entry.gut_rating)
                      const detDiff = diff(det1, det2)

                      return (
                        <tr key={entry.id} className="border-b last:border-0 hover:bg-accent/50">
                          <td className="py-2 pr-4 font-medium">{entry.title}</td>
                          <td className="text-center py-2 px-2">{entry.gut_rating ?? "—"}</td>
                          <td className="text-center py-2 px-2">{user2Entry.gut_rating ?? "—"}</td>
                          <td className={`text-center py-2 px-2 ${gutDiff !== null ? (gutDiff > 0 ? "text-green-600" : gutDiff < 0 ? "text-destructive" : "") : ""}`}>
                            {gutDiff !== null ? `${gutDiff > 0 ? "+" : ""}${gutDiff}` : "—"}
                          </td>
                          <td className="text-center py-2 px-2">{det1 !== null ? det1 : "—"}</td>
                          <td className="text-center py-2 px-2">{det2 !== null ? det2 : "—"}</td>
                          <td className={`text-center py-2 px-2 ${detDiff !== null ? (detDiff > 0 ? "text-green-600" : detDiff < 0 ? "text-destructive" : "") : ""}`}>
                            {detDiff !== null ? `${detDiff > 0 ? "+" : ""}${detDiff}` : "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold mb-3">Average Score Rankings</h2>
            <Tabs defaultValue="gut">
              <TabsList>
                <TabsTrigger value="gut">Gut Rating</TabsTrigger>
                <TabsTrigger value="detailed">Detailed Rating</TabsTrigger>
              </TabsList>

              <TabsContent value="gut" className="space-y-4 mt-4">
                {entries1.filter((e) => e.detailed_enjoyment !== null).length > 0 && entries2.filter((e) => e.detailed_enjoyment !== null).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" /> Top 10 Movies
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={top(movies).map((e) => ({ ...e, score: e.gut_rating || 0 }))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" /> Top 10 TV Shows
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={top(tvShows).map((e) => ({ ...e, score: e.gut_rating || 0 }))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" /> Top 10 Misc
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={top(misc).map((e) => ({ ...e, score: e.gut_rating || 0 }))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" /> Top 10 Overall
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={top(avgEntries).map((e) => ({ ...e, score: e.gut_rating || 0 }))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 Movies
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(movies).map((e) => ({ ...e, score: e.gut_rating || 0 }))} type="worst" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 TV Shows
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(tvShows).map((e) => ({ ...e, score: e.gut_rating || 0 }))} type="worst" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 Misc
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(misc).map((e) => ({ ...e, score: e.gut_rating || 0 }))} type="worst" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 Overall
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(avgEntries).map((e) => ({ ...e, score: e.gut_rating || 0 }))} type="worst" />
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Both users need detailed ratings to show average rankings.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="detailed" className="space-y-4 mt-4">
                {avgEntries.filter((e) => e.score > 0).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" /> Top 10 Movies
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={top(movies.filter((e) => e.score > 0))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" /> Top 10 TV Shows
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={top(tvShows.filter((e) => e.score > 0))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" /> Top 10 Misc
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={top(misc.filter((e) => e.score > 0))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" /> Top 10 Overall
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={top(avgEntries.filter((e) => e.score > 0))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 Movies
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(movies.filter((e) => e.score > 0))} type="worst" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 TV Shows
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(tvShows.filter((e) => e.score > 0))} type="worst" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 Misc
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(misc.filter((e) => e.score > 0))} type="worst" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 Overall
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(avgEntries.filter((e) => e.score > 0))} type="worst" />
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Both users need detailed ratings to show average rankings.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {user1 && user2 && intersection.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No shared entries found between these users.
          </CardContent>
        </Card>
      )}

      {!user1 && !user2 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Search for users above to start comparing ratings.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
