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
  gut_rated_at: string | null
  detailed_enjoyment: number | null
  detailed_impact: number | null
  detailed_recommend: number | null
  detailed_watch_again: number | null
  detailed_rated_at: string | null
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
  pendingDetailedEntries?: { id: string; title: string; media_type: string }[]
  headerTitle?: string
  headerDescription?: string
  showPinSection?: boolean
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

export function DashboardClient({ entries, profile, pinnedUsers = [], pinnedEntries = [], myComparisonEntries = [], pendingDetailedEntries = [], headerTitle, headerDescription, showPinSection = true }: DashboardClientProps) {
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

  const last10Gut = useMemo(
    () => entries
      .filter((e) => e.gut_rating != null && e.gut_rated_at != null)
      .sort((a, b) => new Date(b.gut_rated_at!).getTime() - new Date(a.gut_rated_at!).getTime())
      .slice(0, 10),
    [entries]
  )

  const last10Detailed = useMemo(
    () => entries
      .filter((e) => e.detailed_enjoyment != null && e.detailed_rated_at != null)
      .sort((a, b) => new Date(b.detailed_rated_at!).getTime() - new Date(a.detailed_rated_at!).getTime())
      .slice(0, 10),
    [entries]
  )

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
        <h1 className="text-2xl font-bold">{headerTitle ?? `Hello, ${displayName}`}</h1>
        <p className="text-muted-foreground">{headerDescription ?? "Welcome to the island of misfit toys"}</p>
      </div>

      {pendingDetailedEntries.length > 0 && (
        <div className="bg-destructive/10 border border-destructive text-destructive rounded-md p-4 space-y-1.5">
          <p className="font-semibold">Time&rsquo;s up, time to do detailed rating!</p>
          {pendingDetailedEntries.map((e) => (
            <Link key={e.id} href={`/entries/${e.id}/detailed`} className="block text-sm hover:underline">
              &rarr; {e.title}
            </Link>
          ))}
        </div>
      )}

      {showPinSection && (
        pinnedUsers.length > 0 ? (
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
                      Pinned ({idx + 1}): <Link href={`/users/${pinnedUser.username}`} className="hover:underline">{pinnedUser.display_name || pinnedUser.username}</Link>
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
                            {(() => {
                              const pinTotal = pinnedEntry.detailed_enjoyment! + (pinnedEntry.detailed_impact ?? 0) + (pinnedEntry.detailed_recommend ?? 0) + (pinnedEntry.detailed_watch_again ?? 0)
                              const hasMyDetailed = myComparisonEntry?.detailed_enjoyment != null
                              const myTotal = hasMyDetailed
                                ? myComparisonEntry.detailed_enjoyment! + (myComparisonEntry.detailed_impact ?? 0) + (myComparisonEntry.detailed_recommend ?? 0) + (myComparisonEntry.detailed_watch_again ?? 0)
                                : 0
                              const diff = hasMyDetailed ? myTotal - pinTotal : 0

                              return (
                                <>
                                  <div className="flex gap-x-1 items-baseline text-sm">
                                    <span className="text-muted-foreground shrink-0 w-24">{pinnedUser.display_name || pinnedUser.username}:</span>
                                    <span className="font-medium tabular-nums shrink-0 mr-2">{pinTotal}</span>
                                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">E {pinnedEntry.detailed_enjoyment}/60</span>
                                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">I {pinnedEntry.detailed_impact ?? 0}/20</span>
                                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">R {pinnedEntry.detailed_recommend ?? 0}/10</span>
                                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">W {pinnedEntry.detailed_watch_again ?? 0}/10</span>
                                  </div>
                                  <div className="flex gap-x-1 items-baseline text-sm">
                                    <span className="text-muted-foreground shrink-0 w-24">Your rating:</span>
                                    <span className="font-medium tabular-nums shrink-0 mr-2">{hasMyDetailed ? myTotal : "—"}</span>
                                    {hasMyDetailed ? (
                                      <>
                                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">E {myComparisonEntry.detailed_enjoyment}/60</span>
                                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">I {myComparisonEntry.detailed_impact ?? 0}/20</span>
                                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">R {myComparisonEntry.detailed_recommend ?? 0}/10</span>
                                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">W {myComparisonEntry.detailed_watch_again ?? 0}/10</span>
                                        <span className={`font-medium tabular-nums shrink-0 ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : ""}`}>
                                          {diff > 0 ? "+" : ""}{diff}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">No detailed rating yet</span>
                                    )}
                                  </div>
                                </>
                              )
                            })()}
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
        )
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
          <TabsTrigger value="last10">Last 10 Rated</TabsTrigger>
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

        <TabsContent value="last10" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Last 10 Gut Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                {last10Gut.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries yet.</p>
                ) : (
                  <div className="space-y-1">
                    {last10Gut.map((entry) => {
                      const posterUrl = entry.poster_path
                        ? `https://image.tmdb.org/t/p/w92${entry.poster_path}`
                        : null
                      const dueDate = new Date(new Date(entry.gut_rated_at!).getTime() + 7 * 24 * 60 * 60 * 1000)
                      const hasDetailed = entry.detailed_enjoyment != null
                      return (
                        <Link
                          key={entry.id}
                          href={`/entries/${entry.id}`}
                          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent transition-colors"
                        >
                          {posterUrl ? (
                            <Image src={posterUrl} alt={entry.title} width={28} height={42} className="rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-[28px] h-[42px] rounded bg-muted flex items-center justify-center flex-shrink-0">
                              {entry.media_type === "tv" ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                            </div>
                          )}
                          <span className="text-sm truncate flex-1">{entry.title}</span>
                          <span className="text-sm font-medium tabular-nums shrink-0">{entry.gut_rating}/100</span>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {new Date(entry.gut_rated_at!).toLocaleDateString()}
                          </span>
                          {!hasDetailed && (
                            <span className="text-xs text-muted-foreground/60 italic">
                              Due by {dueDate.toLocaleDateString()}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Last 10 Detailed Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                {last10Detailed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No detailed ratings yet.</p>
                ) : (
                  <div className="space-y-1">
                    {last10Detailed.map((entry) => {
                      const posterUrl = entry.poster_path
                        ? `https://image.tmdb.org/t/p/w92${entry.poster_path}`
                        : null
                      const detailedTotal = (entry.detailed_enjoyment ?? 0) + (entry.detailed_impact ?? 0) + (entry.detailed_recommend ?? 0) + (entry.detailed_watch_again ?? 0)
                      return (
                        <Link
                          key={entry.id}
                          href={`/entries/${entry.id}`}
                          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent transition-colors"
                        >
                          {posterUrl ? (
                            <Image src={posterUrl} alt={entry.title} width={28} height={42} className="rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-[28px] h-[42px] rounded bg-muted flex items-center justify-center flex-shrink-0">
                              {entry.media_type === "tv" ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                            </div>
                          )}
                          <span className="text-sm truncate flex-1">{entry.title}</span>
                          <span className="text-sm font-medium tabular-nums shrink-0">{detailedTotal}/100</span>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {new Date(entry.detailed_rated_at!).toLocaleDateString()}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
