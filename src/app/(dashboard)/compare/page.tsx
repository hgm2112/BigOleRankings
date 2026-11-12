"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RankingList } from "@/components/ranking-list"
import { StatusBadge } from "@/components/status-badge"
import { ScoreChip } from "@/components/score-chip"
import { useCustomization } from "@/components/customization-provider"
import { ENTRY_SELECT, flattenEntries } from "@/lib/entry-queries"
import type { FlatEntry } from "@/lib/entry-queries"
import type { SeasonRatingRow } from "@/lib/compare-stats"
import { TasteMatchSection } from "@/components/compare/taste-match"
import { TrendingUp, TrendingDown, Users, ArrowUp, ArrowDown } from "lucide-react"

interface Profile {
  id: string
  username: string | null
  display_name: string | null
}

type Entry = FlatEntry

type SortField = "title" | "user1_gut" | "user2_gut" | "delta_gut" | "user1_det" | "user2_det" | "delta_det"

function profileLabel(p: Profile, meId: string | null) {
  const name = p.display_name || p.username || "User"
  return p.id === meId ? `${name} (You)` : name
}

export default function ComparePage() {
  const supabase = createClient()
  const { prefs } = useCustomization()
  const [meId, setMeId] = useState<string | null>(null)
  const [options, setOptions] = useState<Profile[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [user1, setUser1] = useState<Profile | null>(null)
  const [user2, setUser2] = useState<Profile | null>(null)
  const [entries1, setEntries1] = useState<Entry[]>([])
  const [entries2, setEntries2] = useState<Entry[]>([])
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  const [seasonCache, setSeasonCache] = useState<{ key: string; rows: SeasonRatingRow[] } | null>(null)

  const seasonKey = user1 && user2 ? `${user1.id}:${user2.id}` : ""
  const seasonRows = seasonCache && seasonCache.key === seasonKey ? seasonCache.rows : []

  useEffect(() => {
    const loadOptions = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setOptionsLoading(false)
        return
      }
      setMeId(user.id)

      const [{ data: meProfile }, { data: followsData }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name").eq("id", user.id).single(),
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
      ])

      const followingIds = (followsData || []).map((f: { following_id: string }) => f.following_id)
      let followingProfiles: Profile[] = []
      if (followingIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", followingIds)
        followingProfiles = (data || []) as Profile[]
      }

      followingProfiles.sort((a, b) =>
        (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "")
      )

      const list: Profile[] = []
      if (meProfile) list.push(meProfile as Profile)
      list.push(...followingProfiles)
      setOptions(list)
      setOptionsLoading(false)
    }
    loadOptions()
  }, [supabase])

  useEffect(() => {
    if (!seasonKey) return
    let cancelled = false
    createClient()
      .from("season_ratings")
      .select("user_id, media_id, season_number, rating, dnf")
      .in("user_id", seasonKey.split(":"))
      .then((res: { data: SeasonRatingRow[] | null }) => {
        if (cancelled) return
        setSeasonCache({ key: seasonKey, rows: res.data ?? [] })
      })
    return () => {
      cancelled = true
    }
  }, [seasonKey])

  const loadEntries = async (profileId: string) => {
    const { data } = await supabase
      .from("ratings")
      .select(ENTRY_SELECT)
      .eq("user_id", profileId)
      .not("gut_rating", "is", null)
    return flattenEntries(data)
  }

  const handleSelect = async (slot: 1 | 2, value: string) => {
    if (!value || value === "none") {
      if (slot === 1) {
        setUser1(null)
        setEntries1([])
      } else {
        setUser2(null)
        setEntries2([])
      }
      return
    }
    const profile = options.find((p) => p.id === value)
    if (!profile) return
    const entries = await loadEntries(profile.id)
    if (slot === 1) {
      setUser1(profile)
      setEntries1(entries)
    } else {
      setUser2(profile)
      setEntries2(entries)
    }
  }

  const intersection = (() => {
    if (!user1 || !user2) return []
    const map2 = new Map(entries2.map((e) => [e.media_id, e]))
    const result: Array<{ entry: Entry; user2Entry: Entry }> = []

    for (const e1 of entries1) {
      const e2 = map2.get(e1.media_id)
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
      status: entry.status ?? null,
      score: hasDetailed ? detAvg : gutAvg,
    }
  })

  const movies = avgEntries.filter((e) => e.media_type === "movie")
  const tvShows = avgEntries.filter((e) => e.media_type === "tv")

  const top = (list: typeof avgEntries) => [...list].sort((a, b) => b.score - a.score).slice(0, 10)
  const worst = (list: typeof avgEntries) => [...list].sort((a, b) => a.score - b.score).slice(0, 10)
  const last10 = (list: Entry[]) => [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10)

  const detailedTotal = (e: Entry) =>
    e.detailed_enjoyment !== null
      ? (e.detailed_enjoyment ?? 0) + (e.detailed_impact ?? 0) + (e.detailed_recommend ?? 0) + (e.detailed_watch_again ?? 0)
      : null

  const diff = (a: number | null, b: number | null) => {
    if (a === null || b === null) return null
    return a - b
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (!sortAsc) {
        setSortField(null)
        setSortAsc(true)
      } else {
        setSortAsc(false)
      }
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const sortedIntersection = useMemo(() => {
    if (!sortField) return intersection

    return [...intersection].sort((a, b) => {
      const { entry: e1, user2Entry: u2e1 } = a
      const { entry: e2, user2Entry: u2e2 } = b
      let cmp = 0
      switch (sortField) {
        case "title":
          cmp = e1.title.localeCompare(e2.title)
          break
        case "user1_gut":
          cmp = (e1.gut_rating ?? 0) - (e2.gut_rating ?? 0)
          break
        case "user2_gut":
          cmp = (u2e1.gut_rating ?? 0) - (u2e2.gut_rating ?? 0)
          break
        case "delta_gut":
          cmp = Math.abs((e1.gut_rating ?? 0) - (u2e1.gut_rating ?? 0)) - Math.abs((e2.gut_rating ?? 0) - (u2e2.gut_rating ?? 0))
          break
        case "user1_det":
          cmp = (detailedTotal(e1) ?? 0) - (detailedTotal(e2) ?? 0)
          break
        case "user2_det":
          cmp = (detailedTotal(u2e1) ?? 0) - (detailedTotal(u2e2) ?? 0)
          break
        case "delta_det":
          cmp = Math.abs((detailedTotal(e1) ?? 0) - (detailedTotal(u2e1) ?? 0)) - Math.abs((detailedTotal(e2) ?? 0) - (detailedTotal(u2e2) ?? 0))
          break
      }
      return sortAsc ? cmp : -cmp
    })
  }, [intersection, sortField, sortAsc])

  const SortHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => {
    const isActive = sortField === field
    return (
      <th
        className={`cursor-pointer select-none py-2 bg-card hover:bg-accent/50 max-sm:sticky max-sm:top-0 max-sm:z-20 ${className ?? ""} ${isActive ? "font-bold" : ""}`}
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {isActive && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </span>
      </th>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compare Users</h1>
        <p className="text-muted-foreground">Who cares what they think? I do. That's why I'm here.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">User 1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user1 && (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{(user1.display_name || user1.username || "U").charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{profileLabel(user1, meId)}</span>
              </div>
            )}
            <Select
              value={user1?.id ?? "none"}
              onValueChange={(value) => handleSelect(1, value)}
              disabled={optionsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={optionsLoading ? "Loading users..." : "Select a user"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{optionsLoading ? "Loading..." : "Select a user"}</SelectItem>
                {options
                  .filter((p) => p.id !== user2?.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {profileLabel(p, meId)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">User 2</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user2 && (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{(user2.display_name || user2.username || "U").charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{profileLabel(user2, meId)}</span>
              </div>
            )}
            <Select
              value={user2?.id ?? "none"}
              onValueChange={(value) => handleSelect(2, value)}
              disabled={optionsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={optionsLoading ? "Loading users..." : "Select a user"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{optionsLoading ? "Loading..." : "Select a user"}</SelectItem>
                {options
                  .filter((p) => p.id !== user1?.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {profileLabel(p, meId)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {user1 && user2 && intersection.length > 0 && (
        <div className="space-y-6">
          <TasteMatchSection
            entriesA={entries1}
            entriesB={entries2}
            nameA={user1.display_name || user1.username || "User 1"}
            nameB={user2.display_name || user2.username || "User 2"}
            userIdA={user1.id}
            userIdB={user2.id}
            seasonRows={seasonRows}
          />

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
              <div className="overflow-auto max-h-[70vh] sm:max-h-none sm:overflow-x-auto sm:overflow-y-visible">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <SortHeader field="title" className="text-left pr-4 max-sm:pr-2 max-sm:left-0 max-sm:z-30 max-sm:w-[8.5rem] max-sm:max-w-[8.5rem]">Title</SortHeader>
                      <SortHeader field="user1_gut" className="text-center px-2 max-sm:px-1.5">{user1.display_name || user1.username} Gut</SortHeader>
                      <SortHeader field="user2_gut" className="text-center px-2 max-sm:px-1.5">{user2.display_name || user2.username} Gut</SortHeader>
                      <SortHeader field="delta_gut" className="text-center px-2 max-sm:px-1.5">Δ Gut</SortHeader>
                      <SortHeader field="user1_det" className="text-center px-2 max-sm:px-1.5">{user1.display_name || user1.username} Det</SortHeader>
                      <SortHeader field="user2_det" className="text-center px-2 max-sm:px-1.5">{user2.display_name || user2.username} Det</SortHeader>
                      <SortHeader field="delta_det" className="text-center pl-2 max-sm:px-1.5">Δ Det</SortHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedIntersection.map(({ entry, user2Entry }) => {
                      const det1 = detailedTotal(entry)
                      const det2 = detailedTotal(user2Entry)
                      const gutDiff = diff(entry.gut_rating, user2Entry.gut_rating)
                      const detDiff = diff(det1, det2)

                      return (
                        <tr key={entry.id} className="border-b last:border-0 hover:bg-accent/50">
                          <td className="py-2 pr-4 font-medium max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:bg-card max-sm:w-[8.5rem] max-sm:max-w-[8.5rem] max-sm:pr-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate" title={entry.title}>{entry.title}</span>
                              <span className="hidden sm:inline-flex shrink-0">
                                <StatusBadge status={entry.status ?? null} mediaType={entry.media_type} />
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-2 px-2 max-sm:px-1.5">
                            {prefs.score_chips ? <ScoreChip value={entry.gut_rating} /> : entry.gut_rating ?? "—"}
                          </td>
                          <td className="text-center py-2 px-2 max-sm:px-1.5">
                            {prefs.score_chips ? <ScoreChip value={user2Entry.gut_rating} /> : user2Entry.gut_rating ?? "—"}
                          </td>
                          <td className={`text-center py-2 px-2 max-sm:px-1.5 ${gutDiff !== null ? (gutDiff > 0 ? "text-green-600" : gutDiff < 0 ? "text-destructive" : "") : ""}`}>
                            {gutDiff !== null ? `${gutDiff > 0 ? "+" : ""}${gutDiff}` : "—"}
                          </td>
                          <td className="text-center py-2 px-2 max-sm:px-1.5">
                            {prefs.score_chips ? <ScoreChip value={det1} /> : det1 !== null ? det1 : "—"}
                          </td>
                          <td className="text-center py-2 px-2 max-sm:px-1.5">
                            {prefs.score_chips ? <ScoreChip value={det2} /> : det2 !== null ? det2 : "—"}
                          </td>
                          <td className={`text-center py-2 px-2 max-sm:px-1.5 ${detDiff !== null ? (detDiff > 0 ? "text-green-600" : detDiff < 0 ? "text-destructive" : "") : ""}`}>
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
                        <RankingList title="" entries={top(movies.map((e) => ({ ...e, score: e.gut_rating || 0 })))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" /> Top 10 TV Shows
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={top(tvShows.map((e) => ({ ...e, score: e.gut_rating || 0 })))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" /> Top 10 Overall
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={top(avgEntries.map((e) => ({ ...e, score: e.gut_rating || 0 })))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 Movies
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(movies.map((e) => ({ ...e, score: e.gut_rating || 0 })))} type="worst" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 TV Shows
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(tvShows.map((e) => ({ ...e, score: e.gut_rating || 0 })))} type="worst" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 Overall
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(avgEntries.map((e) => ({ ...e, score: e.gut_rating || 0 })))} type="worst" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-primary" /> Last 10 Rated: {user1.display_name || user1.username}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={last10(entries1).map((e) => ({ ...e, score: e.gut_rating || 0 }))} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-primary" /> Last 10 Rated: {user2.display_name || user2.username}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={last10(entries2).map((e) => ({ ...e, score: e.gut_rating || 0 }))} type="best" />
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
                          <TrendingDown className="h-4 w-4 text-destructive" /> Worst 10 Overall
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={worst(avgEntries.filter((e) => e.score > 0))} type="worst" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-primary" /> Last 10 Rated: {user1.display_name || user1.username}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={last10(entries1).filter((e) => e.detailed_enjoyment !== null).map((e) => {
                          const score = (e.detailed_enjoyment ?? 0) + (e.detailed_impact ?? 0) + (e.detailed_recommend ?? 0) + (e.detailed_watch_again ?? 0)
                          return { ...e, score }
                        })} type="best" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-primary" /> Last 10 Rated: {user2.display_name || user2.username}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankingList title="" entries={last10(entries2).filter((e) => e.detailed_enjoyment !== null).map((e) => {
                          const score = (e.detailed_enjoyment ?? 0) + (e.detailed_impact ?? 0) + (e.detailed_recommend ?? 0) + (e.detailed_watch_again ?? 0)
                          return { ...e, score }
                        })} type="best" />
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
