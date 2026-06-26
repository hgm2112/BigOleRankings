"use client"

import { useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RankingList } from "@/components/ranking-list"
import { BarChart3, TrendingUp, TrendingDown, Pin, Film, Tv, Clock } from "lucide-react"

interface Entry {
  id: string
  title: string
  media_type: string
  poster_path: string | null
  year: number | null
  gut_rating: number | null
  detailed_enjoyment: number | null
  detailed_impact: number | null
  detailed_recommend: number | null
  detailed_watch_again: number | null
  notes: string | null
  weight: number
  runtime: number | null
  user_id?: string
  tmdb_id?: number
  created_at?: string
}

interface DashboardClientProps {
  entries: Entry[]
  profile: { username: string | null; display_name: string | null } | null
  pinnedUsers?: { username: string | null; display_name: string | null }[]
  pinnedEntries?: (Entry | null)[]
  myComparisonEntries?: (Entry | null)[]
  headerTitle?: string
  headerDescription?: string
}

function computeRankings(entries: Entry[], useDetailed: boolean, ascending: boolean) {
  return entries
    .map((e) => {
      let score = useDetailed && e.detailed_enjoyment !== null
        ? (e.detailed_enjoyment ?? 0) + (e.detailed_impact ?? 0) + (e.detailed_recommend ?? 0) + (e.detailed_watch_again ?? 0)
        : e.gut_rating ?? 0

      return { ...e, score }
    })
    .sort((a, b) => {
      const scoreDiff = ascending ? a.score - b.score : b.score - a.score
      if (scoreDiff !== 0) return scoreDiff
      const weightDiff = ascending ? (a.weight ?? 0) - (b.weight ?? 0) : (b.weight ?? 0) - (a.weight ?? 0)
      if (weightDiff !== 0) return weightDiff
      return a.title.localeCompare(b.title)
    })
    .slice(0, 10)
}

export function DashboardClient({ entries, profile, pinnedUsers = [], pinnedEntries = [], myComparisonEntries = [], headerTitle, headerDescription }: DashboardClientProps) {
  const displayName = profile?.display_name || profile?.username || "User"

  const allEntries = useMemo(
    () => entries.filter((e) => e.gut_rating !== null),
    [entries]
  )
  const movies = useMemo(() => allEntries.filter((e) => e.media_type === "movie"), [allEntries])
  const tvShows = useMemo(() => allEntries.filter((e) => e.media_type === "tv"), [allEntries])
  const misc = useMemo(() => allEntries.filter((e) => e.media_type === "misc"), [allEntries])

  const sections = [
    { label: "Top 10 Movies", entries: movies, useDetailed: false, ascending: false, type: "best" as const },
    { label: "Top 10 TV Shows", entries: tvShows, useDetailed: false, ascending: false, type: "best" as const },
    { label: "Top 10 Overall", entries: allEntries, useDetailed: false, ascending: false, type: "best" as const },
    { label: "Worst 10 Movies", entries: movies, useDetailed: false, ascending: true, type: "worst" as const },
    { label: "Worst 10 TV Shows", entries: tvShows, useDetailed: false, ascending: true, type: "worst" as const },
    { label: "Worst 10 Overall", entries: allEntries, useDetailed: false, ascending: true, type: "worst" as const },
  ]

  const sectionsDetailed = [
    { label: "Top 10 Movies", entries: movies.filter((e) => e.detailed_enjoyment !== null), useDetailed: true, ascending: false, type: "best" as const },
    { label: "Top 10 TV Shows", entries: tvShows.filter((e) => e.detailed_enjoyment !== null), useDetailed: true, ascending: false, type: "best" as const },
    { label: "Top 10 Overall", entries: allEntries.filter((e) => e.detailed_enjoyment !== null), useDetailed: true, ascending: false, type: "best" as const },
    { label: "Worst 10 Movies", entries: movies.filter((e) => e.detailed_enjoyment !== null), useDetailed: true, ascending: true, type: "worst" as const },
    { label: "Worst 10 TV Shows", entries: tvShows.filter((e) => e.detailed_enjoyment !== null), useDetailed: true, ascending: true, type: "worst" as const },
    { label: "Worst 10 Overall", entries: allEntries.filter((e) => e.detailed_enjoyment !== null), useDetailed: true, ascending: true, type: "worst" as const },
  ]

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
  }

  const movieWatchTime = useMemo(
    () => movies.reduce((sum, e) => sum + (e.runtime ?? 0), 0),
    [movies]
  )
  const tvWatchTime = useMemo(
    () => tvShows.reduce((sum, e) => sum + (e.runtime ?? 0), 0),
    [tvShows]
  )
  const totalWatchTime = movieWatchTime + tvWatchTime

  const stats = [
    { label: "Total Entries", value: allEntries.length, icon: BarChart3 },
    { label: "Movies", value: movies.length, icon: BarChart3 },
    { label: "TV Shows", value: tvShows.length, icon: BarChart3 },
    { label: "Misc", value: misc.length, icon: BarChart3 },
    {
      label: "Avg Gut Rating",
      value: allEntries.length > 0
        ? (allEntries.reduce((sum, e) => sum + (e.gut_rating ?? 0), 0) / allEntries.length).toFixed(1)
        : "—",
      icon: TrendingUp,
    },
    {
      label: "Avg Detailed Rating",
      value: (() => {
        const detailed = allEntries.filter((e) => e.detailed_enjoyment !== null)
        return detailed.length > 0
          ? (detailed.reduce((sum, e) => sum + (e.detailed_enjoyment ?? 0) + (e.detailed_impact ?? 0) + (e.detailed_recommend ?? 0) + (e.detailed_watch_again ?? 0), 0) / detailed.length).toFixed(1)
          : "—"
      })(),
      icon: TrendingUp,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{headerTitle ?? `Welcome, ${displayName}`}</h1>
        <p className="text-muted-foreground">{headerDescription ?? "Your ranking dashboard"}</p>
      </div>

      {pinnedUsers.length > 0 ? (
        <div className="space-y-3">
          {pinnedUsers.map((pinnedUser, idx) => {
            const pinnedEntry = pinnedEntries[idx]
            const myComparisonEntry = myComparisonEntries[idx]
            if (!pinnedEntry) return null

            return (
              <Card key={idx}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <Pin className="h-4 w-4" />
                    Pinned ({idx + 1}): {pinnedUser.display_name || pinnedUser.username}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    {pinnedEntry.poster_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${pinnedEntry.poster_path}`}
                        alt={pinnedEntry.title}
                        width={46}
                        height={69}
                        className="rounded object-contain bg-muted flex-shrink-0"
                      />
                    ) : (
                      <div className="w-[46px] h-[69px] rounded bg-muted flex items-center justify-center flex-shrink-0">
                        {pinnedEntry.media_type === "tv" ? <Tv className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <Link href={`/entries/${pinnedEntry.id}`} className="font-semibold hover:underline line-clamp-1">
                        {pinnedEntry.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {pinnedEntry.year} &middot; {pinnedEntry.media_type === "tv" ? "TV Show" : pinnedEntry.media_type === "misc" ? "Misc" : "Movie"}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{pinnedUser.display_name || pinnedUser.username}: </span>
                          <span className="font-medium">{pinnedEntry.gut_rating ?? "—"}</span>
                          <span className="text-xs text-muted-foreground">/100</span>
                        </div>
                        {myComparisonEntry ? (
                          <>
                            <div>
                              <span className="text-muted-foreground">Your rating: </span>
                              <span className="font-medium">{myComparisonEntry.gut_rating ?? "—"}</span>
                              <span className="text-xs text-muted-foreground">/100</span>
                            </div>
                            {pinnedEntry.gut_rating != null && myComparisonEntry.gut_rating != null && (
                              <div>
                                <span className="text-muted-foreground">Δ </span>
                                <span className={`font-medium ${myComparisonEntry.gut_rating > pinnedEntry.gut_rating ? "text-green-600" : myComparisonEntry.gut_rating < pinnedEntry.gut_rating ? "text-destructive" : ""}`}>
                                  {myComparisonEntry.gut_rating - pinnedEntry.gut_rating > 0 ? "+" : ""}{myComparisonEntry.gut_rating - pinnedEntry.gut_rating}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">You haven't rated this yet.</p>
                        )}
                      </div>

                      {pinnedEntry.detailed_enjoyment != null && (
                        <div className="space-y-0.5 pt-1.5 border-t border-border/50">
                          <div className="text-sm">
                            <span className="text-muted-foreground">{pinnedUser.display_name || pinnedUser.username}: </span>
                            <span className="font-medium">
                              {pinnedEntry.detailed_enjoyment + (pinnedEntry.detailed_impact ?? 0) + (pinnedEntry.detailed_recommend ?? 0) + (pinnedEntry.detailed_watch_again ?? 0)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {' '}E {pinnedEntry.detailed_enjoyment}/60 · I {pinnedEntry.detailed_impact ?? 0}/20 · R {pinnedEntry.detailed_recommend ?? 0}/10 · W {pinnedEntry.detailed_watch_again ?? 0}/10
                            </span>
                          </div>
                          {myComparisonEntry?.detailed_enjoyment != null ? (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Your rating: </span>
                              <span className="font-medium">
                                {myComparisonEntry.detailed_enjoyment + (myComparisonEntry.detailed_impact ?? 0) + (myComparisonEntry.detailed_recommend ?? 0) + (myComparisonEntry.detailed_watch_again ?? 0)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {' '}E {myComparisonEntry.detailed_enjoyment}/60 · I {myComparisonEntry.detailed_impact ?? 0}/20 · R {myComparisonEntry.detailed_recommend ?? 0}/10 · W {myComparisonEntry.detailed_watch_again ?? 0}/10
                              </span>
                              {(() => {
                                const pinTotal = pinnedEntry.detailed_enjoyment! + (pinnedEntry.detailed_impact ?? 0) + (pinnedEntry.detailed_recommend ?? 0) + (pinnedEntry.detailed_watch_again ?? 0)
                                const myTotal = myComparisonEntry.detailed_enjoyment! + (myComparisonEntry.detailed_impact ?? 0) + (myComparisonEntry.detailed_recommend ?? 0) + (myComparisonEntry.detailed_watch_again ?? 0)
                                const diff = myTotal - pinTotal
                                return (
                                  <span>
                                    <span className="text-muted-foreground"> · Δ </span>
                                    <span className={`font-medium ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : ""}`}>
                                      {diff > 0 ? "+" : ""}{diff}
                                    </span>
                                  </span>
                                )
                              })()}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">You haven't rated this with detailed scoring.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Pin className="h-4 w-4" />
              Pin a user from the <Link href="/social" className="underline hover:text-foreground">Social</Link> page to see their latest rating here.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 pt-6">
                <Icon className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="gut">
        <TabsList>
          <TabsTrigger value="gut">Gut Rating</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Rating</TabsTrigger>
        </TabsList>

        <TabsContent value="gut" className="space-y-6">
          {allEntries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No entries yet. Start rating movies and TV shows!
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sections.map((section) => (
                <Card key={section.label}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-1">
                      {section.type === "worst" ? <TrendingDown className="h-4 w-4 text-destructive" /> : <TrendingUp className="h-4 w-4 text-green-600" />}
                      {section.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RankingList
                      title=""
                      entries={computeRankings(section.entries, section.useDetailed, section.ascending)}
                      type={section.type}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="detailed" className="space-y-6">
          {entries.filter((e) => e.detailed_enjoyment !== null).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No detailed ratings yet. Add detailed ratings to entries to see them here.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sectionsDetailed.map((section) => (
                <Card key={section.label}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-1">
                      {section.type === "worst" ? <TrendingDown className="h-4 w-4 text-destructive" /> : <TrendingUp className="h-4 w-4 text-green-600" />}
                      {section.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RankingList
                      title=""
                      entries={computeRankings(section.entries, section.useDetailed, section.ascending)}
                      type={section.type}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div>
        <h2 className="text-lg font-semibold mb-3">Watch Time</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{movieWatchTime > 0 ? formatMinutes(movieWatchTime) : "—"}</p>
                <p className="text-xs text-muted-foreground">Movies</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{tvWatchTime > 0 ? formatMinutes(tvWatchTime) : "—"}</p>
                <p className="text-xs text-muted-foreground">TV Shows</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalWatchTime > 0 ? formatMinutes(totalWatchTime) : "—"}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
