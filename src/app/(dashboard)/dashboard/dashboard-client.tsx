"use client"

import { useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RankingList } from "@/components/ranking-list"
import { BarChart3, TrendingUp, TrendingDown, Pin, Film, Tv } from "lucide-react"

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
  user_id?: string
  tmdb_id?: number
  created_at?: string
}

interface DashboardClientProps {
  entries: Entry[]
  profile: { username: string | null; display_name: string | null } | null
  pinnedUser?: { username: string | null; display_name: string | null } | null
  pinnedEntry?: Entry | null
  myComparisonEntry?: Entry | null
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

export function DashboardClient({ entries, profile, pinnedUser, pinnedEntry, myComparisonEntry }: DashboardClientProps) {
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
        <h1 className="text-2xl font-bold">Welcome, {displayName}</h1>
        <p className="text-muted-foreground">Your ranking dashboard</p>
      </div>

      {pinnedUser && pinnedEntry ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Pin className="h-4 w-4" />
              Pinned: {pinnedUser.display_name || pinnedUser.username}
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
              </div>
            </div>
          </CardContent>
        </Card>
      ) : pinnedUser === null && !pinnedEntry ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Pin className="h-4 w-4" />
              Pin a user from the <Link href="/social" className="underline hover:text-foreground">Social</Link> page to see their latest rating here.
            </p>
          </CardContent>
        </Card>
      ) : null}

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
    </div>
  )
}
