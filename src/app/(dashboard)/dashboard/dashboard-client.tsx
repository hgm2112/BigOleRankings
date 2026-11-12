"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RankingList } from "@/components/ranking-list"
import { StatusBadge } from "@/components/status-badge"
import { ScoreChip } from "@/components/score-chip"
import { MediaTypeBadge } from "@/components/media-type-badge"
import { useCustomization } from "@/components/customization-provider"
import { BarChart3, TrendingUp, TrendingDown, Pin, Film, Tv, Clock, ListChecks, PlayCircle, ChevronDown, ChevronUp } from "lucide-react"

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
  status?: string | null
  user_id?: string
  tmdb_id?: number
  created_at?: string
}

interface PinnedWatchItem {
  id: string
  media_type: "movie" | "tv"
  season_number: number | null
  started_at: string
  media: {
    id: string
    tmdb_id: number
    media_type: "movie" | "tv"
    title: string
    poster_path: string | null
    year: number | null
  }
}

interface DashboardClientProps {
  entries: Entry[]
  profile: { username: string | null; display_name: string | null } | null
  pinnedUsers?: { username: string | null; display_name: string | null }[]
  pinnedEntries?: (Entry | null)[]
  myComparisonEntries?: (Entry | null)[]
  pinnedWatching?: PinnedWatchItem[][]
  pendingDetailedEntries?: { id: string; title: string; media_type: string }[]
  headerTitle?: string
  headerDescription?: string
  showPinSection?: boolean
  fullRankingsHref?: string
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

function PinnedLastRated({ pinnedUser, pinnedEntry, myComparisonEntry }: {
  pinnedUser: { username: string | null; display_name: string | null }
  pinnedEntry: Entry | null
  myComparisonEntry: Entry | null
}) {
  const { prefs } = useCustomization()
  if (!pinnedEntry) {
    return <p className="text-sm text-muted-foreground">No ratings yet.</p>
  }

  const pinTotal = (pinnedEntry.detailed_enjoyment ?? 0) + (pinnedEntry.detailed_impact ?? 0) + (pinnedEntry.detailed_recommend ?? 0) + (pinnedEntry.detailed_watch_again ?? 0)
  const hasMyDetailed = myComparisonEntry?.detailed_enjoyment != null
  const myTotal = hasMyDetailed
    ? (myComparisonEntry.detailed_enjoyment ?? 0) + (myComparisonEntry.detailed_impact ?? 0) + (myComparisonEntry.detailed_recommend ?? 0) + (myComparisonEntry.detailed_watch_again ?? 0)
    : 0
  const diff = hasMyDetailed ? myTotal - pinTotal : 0
  const gutDiff =
    pinnedEntry.gut_rating != null && myComparisonEntry?.gut_rating != null
      ? myComparisonEntry.gut_rating - pinnedEntry.gut_rating
      : null
  const pinnedName = pinnedUser.display_name || pinnedUser.username

  const poster = pinnedEntry.poster_path ? (
    <div className="relative w-16 h-24 rounded overflow-hidden bg-muted flex-shrink-0">
      <Image
        src={`https://image.tmdb.org/t/p/w185${pinnedEntry.poster_path}`}
        alt={pinnedEntry.title}
        fill
        sizes="64px"
        quality={90}
        className="object-cover"
      />
    </div>
  ) : (
    <div className="w-16 h-24 rounded bg-muted flex items-center justify-center flex-shrink-0">
      {pinnedEntry.media_type === "tv" ? <Tv className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
    </div>
  )

  return (
    <>
      <div className="hidden sm:flex gap-3">
        {poster}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Link href={`/entries/${pinnedEntry.id}`} className="font-semibold hover:underline line-clamp-1">
              {pinnedEntry.title}
            </Link>
            <StatusBadge status={pinnedEntry.status ?? null} mediaType={pinnedEntry.media_type} />
          </div>
          <p className="text-xs text-muted-foreground">
            {pinnedEntry.year} &middot; {prefs.media_badges ? <MediaTypeBadge type={pinnedEntry.media_type} /> : pinnedEntry.media_type === "tv" ? "TV Show" : "Movie"}
          </p>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">{pinnedName}: </span>
              {prefs.score_chips ? (
                <ScoreChip value={pinnedEntry.gut_rating} />
              ) : (
                <span className="font-medium">{pinnedEntry.gut_rating ?? "—"}</span>
              )}
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            {myComparisonEntry ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Your rating: </span>
                  {prefs.score_chips ? (
                    <ScoreChip value={myComparisonEntry.gut_rating} />
                  ) : (
                    <span className="font-medium">{myComparisonEntry.gut_rating ?? "—"}</span>
                  )}
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
                {gutDiff != null && (
                  <div>
                    <span className="text-muted-foreground">Δ </span>
                    <span className={`font-medium ${gutDiff > 0 ? "text-green-600" : gutDiff < 0 ? "text-destructive" : ""}`}>
                      {gutDiff > 0 ? "+" : ""}{gutDiff}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">You haven&apos;t seen this yet.</p>
            )}
          </div>

          {pinnedEntry.detailed_enjoyment != null && (
            <div className="border-t border-border/50 pt-1.5 space-y-0.5">
              <div className="flex gap-x-1 items-baseline text-sm flex-wrap">
                <span className="font-medium text-foreground shrink-0 w-24">{pinnedName}:</span>
                {prefs.score_chips ? <ScoreChip value={pinTotal} /> : <span className="font-medium tabular-nums shrink-0 mr-2">{pinTotal}</span>}
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">E {pinnedEntry.detailed_enjoyment}/60</span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">I {pinnedEntry.detailed_impact ?? 0}/20</span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">R {pinnedEntry.detailed_recommend ?? 0}/10</span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">W {pinnedEntry.detailed_watch_again ?? 0}/10</span>
              </div>
              {hasMyDetailed && (
                <div className="flex gap-x-1 items-baseline text-sm flex-wrap">
                  <span className="text-muted-foreground shrink-0 w-24">Your rating:</span>
                  {prefs.score_chips ? <ScoreChip value={myTotal} /> : <span className="font-medium tabular-nums shrink-0 mr-2">{myTotal}</span>}
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">E {myComparisonEntry.detailed_enjoyment}/60</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">I {myComparisonEntry.detailed_impact ?? 0}/20</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">R {myComparisonEntry.detailed_recommend ?? 0}/10</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">W {myComparisonEntry.detailed_watch_again ?? 0}/10</span>
                  <span className={`font-medium tabular-nums shrink-0 ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : ""}`}>
                    {diff > 0 ? "+" : ""}{diff}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sm:hidden">
        <div className="flex gap-3">
          {poster}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/entries/${pinnedEntry.id}`} className="font-semibold hover:underline line-clamp-1">
                {pinnedEntry.title}
              </Link>
              <StatusBadge status={pinnedEntry.status ?? null} mediaType={pinnedEntry.media_type} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pinnedEntry.year} &middot; {prefs.media_badges ? <MediaTypeBadge type={pinnedEntry.media_type} /> : pinnedEntry.media_type === "tv" ? "TV Show" : "Movie"}
            </p>
            <div className="mt-1 space-y-0.5 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground shrink-0 w-28 truncate">{pinnedName}:</span>
                {prefs.score_chips ? (
                  <ScoreChip value={pinnedEntry.gut_rating} />
                ) : (
                  <span className="font-medium">{pinnedEntry.gut_rating ?? "—"}</span>
                )}
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
              {myComparisonEntry ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground shrink-0 w-28">Your rating:</span>
                  {prefs.score_chips ? (
                    <ScoreChip value={myComparisonEntry.gut_rating} />
                  ) : (
                    <span className="font-medium">{myComparisonEntry.gut_rating ?? "—"}</span>
                  )}
                  <span className="text-xs text-muted-foreground">/100</span>
                  {gutDiff != null && (
                    <span className={`font-medium ${gutDiff > 0 ? "text-green-600" : gutDiff < 0 ? "text-destructive" : ""}`}>
                      {gutDiff > 0 ? "+" : ""}{gutDiff}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">You haven&apos;t seen this yet.</p>
              )}
            </div>
          </div>
        </div>

        {pinnedEntry.detailed_enjoyment != null && (
          <div className="border-t border-border/50 mt-2 pt-2 space-y-1 text-sm">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-foreground shrink-0 w-28 truncate">{pinnedName}:</span>
              {prefs.score_chips ? <ScoreChip value={pinTotal} /> : <span className="font-medium tabular-nums">{pinTotal}</span>}
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <div className="flex gap-x-2 items-baseline flex-wrap text-xs text-muted-foreground tabular-nums">
              <span><span className="font-semibold text-foreground">E</span> {pinnedEntry.detailed_enjoyment}/60</span>
              <span><span className="font-semibold text-foreground">I</span> {pinnedEntry.detailed_impact ?? 0}/20</span>
              <span><span className="font-semibold text-foreground">R</span> {pinnedEntry.detailed_recommend ?? 0}/10</span>
              <span><span className="font-semibold text-foreground">W</span> {pinnedEntry.detailed_watch_again ?? 0}/10</span>
            </div>
            {hasMyDetailed && (
              <>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground shrink-0 w-28">Your rating:</span>
                  {prefs.score_chips ? <ScoreChip value={myTotal} /> : <span className="font-medium tabular-nums">{myTotal}</span>}
                  <span className="text-xs text-muted-foreground">/100</span>
                  <span className={`font-medium ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : ""}`}>
                    {diff > 0 ? "+" : ""}{diff}
                  </span>
                </div>
                <div className="flex gap-x-2 items-baseline flex-wrap text-xs text-muted-foreground tabular-nums">
                  <span><span className="font-semibold text-foreground">E</span> {myComparisonEntry.detailed_enjoyment}/60</span>
                  <span><span className="font-semibold text-foreground">I</span> {myComparisonEntry.detailed_impact ?? 0}/20</span>
                  <span><span className="font-semibold text-foreground">R</span> {myComparisonEntry.detailed_recommend ?? 0}/10</span>
                  <span><span className="font-semibold text-foreground">W</span> {myComparisonEntry.detailed_watch_again ?? 0}/10</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function PinnedCurrentlyWatching({ items, username }: { items: PinnedWatchItem[]; username: string | null }) {
  const { prefs } = useCustomization()
  const [expanded, setExpanded] = useState(false)
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">Not currently watching anything.</p>
  }

  const latest = items[0]
  const rest = items.slice(1)

  const renderItem = (w: PinnedWatchItem, showToggle: boolean) => (
    <div key={w.id} className="flex gap-3">
      {w.media.poster_path ? (
        <div className="relative w-16 h-24 rounded overflow-hidden bg-muted flex-shrink-0">
          <Image
            src={`https://image.tmdb.org/t/p/w185${w.media.poster_path}`}
            alt={w.media.title}
            fill
            sizes="64px"
            quality={90}
            className="object-cover"
          />
        </div>
      ) : (
        <div className="w-16 h-24 rounded bg-muted flex items-center justify-center flex-shrink-0">
          {w.media.media_type === "tv" ? <Tv className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold line-clamp-1">{w.media.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {prefs.media_badges ? <MediaTypeBadge type={w.media.media_type} /> : <span>{w.media.media_type === "tv" ? "TV Show" : "Movie"}</span>}
          {w.media.media_type === "tv" && w.season_number != null && <span>Season {w.season_number}</span>}
          {w.media.year && <span>{w.media.year}</span>}
        </div>
        <p className="text-xs text-muted-foreground">Started {w.started_at}</p>
        <div className="flex items-center justify-between gap-2">
          {username ? (
            <Link
              href={`/users/${encodeURIComponent(username)}/watching`}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              View All
            </Link>
          ) : (
            <span />
          )}
          {showToggle && rest.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? "Show less currently watching" : `Show ${rest.length} more currently watching`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span>{expanded ? "Show less" : `Show ${rest.length} more`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {renderItem(latest, true)}
      {expanded && rest.length > 0 && <div className="space-y-3">{rest.map((w) => renderItem(w, false))}</div>}
    </div>
  )
}

function toTime(value: string | null | undefined): number {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}

function PinnedFriendCard({ pinnedUser, pinnedEntry, myComparisonEntry, watchingItems, idx }: {
  pinnedUser: { username: string | null; display_name: string | null }
  pinnedEntry: Entry | null
  myComparisonEntry: Entry | null
  watchingItems: PinnedWatchItem[]
  idx: number
}) {
  const ratedAt = pinnedEntry
    ? Math.max(
        toTime(pinnedEntry.detailed_rated_at),
        toTime(pinnedEntry.gut_rated_at),
        toTime((pinnedEntry as any).updated_at),
        toTime(pinnedEntry.created_at)
      )
    : 0

  const watchingAt = (watchingItems ?? []).reduce((max, w) => {
    const started = w.started_at ? toTime(`${w.started_at}T23:59:59`) : 0
    const t = Math.max(toTime((w as any).updated_at), toTime((w as any).created_at), started)
    return t > max ? t : max
  }, 0)

  const defaultTab =
    watchingAt === 0 && ratedAt === 0 ? "watching" :
    watchingAt >= ratedAt ? "watching" : "last_rated"

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
          <Pin className="h-4 w-4" />
          Pinned ({idx + 1}): <Link href={`/users/${pinnedUser.username}`} className="font-semibold text-foreground hover:underline">{pinnedUser.display_name || pinnedUser.username}</Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="watching" className="text-xs"><PlayCircle className="h-3.5 w-3.5 mr-1" />Currently Watching</TabsTrigger>
            <TabsTrigger value="last_rated" className="text-xs">Last Rated</TabsTrigger>
          </TabsList>
          <TabsContent value="watching" className="mt-3">
            <PinnedCurrentlyWatching items={watchingItems} username={pinnedUser.username} />
          </TabsContent>
          <TabsContent value="last_rated" className="mt-3">
            <PinnedLastRated pinnedUser={pinnedUser} pinnedEntry={pinnedEntry} myComparisonEntry={myComparisonEntry} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export function DashboardClient({ entries, profile, pinnedUsers = [], pinnedEntries = [], myComparisonEntries = [], pinnedWatching = [], pendingDetailedEntries = [], headerTitle, headerDescription, showPinSection = true, fullRankingsHref }: DashboardClientProps) {
  const { prefs } = useCustomization()
  const displayName = profile?.display_name || profile?.username || "User"

  const allEntries = useMemo(
    () => entries.filter((e) => e.gut_rating !== null),
    [entries]
  )
  const movies = useMemo(() => allEntries.filter((e) => e.media_type === "movie"), [allEntries])
  const tvShows = useMemo(() => allEntries.filter((e) => e.media_type === "tv"), [allEntries])

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

  const [watched30dCutoff] = useState(() => Date.now() - 30 * 24 * 60 * 60 * 1000)

  const watched30d = useMemo(() => {
    return allEntries.reduce((sum, e) => {
      const created = e.created_at ? new Date(e.created_at).getTime() : NaN
      return created >= watched30dCutoff ? sum + (e.runtime ?? 0) : sum
    }, 0)
  }, [allEntries, watched30dCutoff])

  const stats = [
    { label: "Total Entries", value: allEntries.length, icon: BarChart3, iconClass: "text-sky-500", chipClass: "bg-sky-500/10" },
    { label: "Movies", value: movies.length, icon: BarChart3, iconClass: "text-rose-500", chipClass: "bg-rose-500/10" },
    { label: "TV Shows", value: tvShows.length, icon: BarChart3, iconClass: "text-violet-500", chipClass: "bg-violet-500/10" },
    {
      label: "Avg Gut Rating",
      value: allEntries.length > 0
        ? (allEntries.reduce((sum, e) => sum + (e.gut_rating ?? 0), 0) / allEntries.length).toFixed(1)
        : "—",
      icon: TrendingUp,
      iconClass: "text-amber-500",
      chipClass: "bg-amber-500/10",
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
      iconClass: "text-emerald-500",
      chipClass: "bg-emerald-500/10",
    },
    {
      label: "Hours Watched (30d)",
      value: watched30d > 0 ? (Math.round(watched30d / 60) === 0 ? "<1h" : `${Math.round(watched30d / 60)}h`) : "—",
      icon: Clock,
      iconClass: "text-cyan-500",
      chipClass: "bg-cyan-500/10",
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinnedUsers.map((pinnedUser, idx) => (
              <PinnedFriendCard
                key={idx}
                pinnedUser={pinnedUser}
                pinnedEntry={pinnedEntries[idx] ?? null}
                myComparisonEntry={myComparisonEntries[idx] ?? null}
                watchingItems={pinnedWatching[idx] ?? []}
                idx={idx}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Pin className="h-4 w-4" />
                Pin a user from the <Link href="/social" className="underline hover:text-foreground">Social</Link> page to see their latest rating and currently watching activity here.
              </p>
            </CardContent>
          </Card>
        )
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-2 p-3 sm:gap-3 sm:p-6">
                {prefs.stat_chips ? (
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stat.chipClass}`}>
                    <Icon className={`h-5 w-5 ${stat.iconClass}`} />
                  </div>
                ) : (
                  <Icon className="h-8 w-8 text-muted-foreground" />
                )}
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {fullRankingsHref && (
        <Card>
          <CardContent className="py-4">
            <Link href={fullRankingsHref} className="text-sm font-medium flex items-center gap-2 hover:underline">
              <ListChecks className="h-4 w-4" />
              See {displayName}&rsquo;s full rankings
            </Link>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="gut">
        <TabsList className="mx-auto flex w-max max-w-full sm:mx-0">
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
                    <CardTitle className="text-sm flex items-center justify-center gap-1 text-center sm:justify-start sm:text-left">
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
                    <CardTitle className="text-sm flex items-center justify-center gap-1 text-center sm:justify-start sm:text-left">
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
                        ? `https://image.tmdb.org/t/p/w154${entry.poster_path}`
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
                            <Image src={posterUrl} alt={entry.title} width={28} height={42} quality={90} className="rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-[28px] h-[42px] rounded bg-muted flex items-center justify-center flex-shrink-0">
                              {entry.media_type === "tv" ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                            </div>
                          )}
                          <span className="text-sm truncate flex-1">{entry.title}</span>
                          <StatusBadge status={entry.status ?? null} mediaType={entry.media_type} />
                          {prefs.score_chips ? (
                            <ScoreChip value={entry.gut_rating} />
                          ) : (
                            <span className="text-sm font-medium tabular-nums shrink-0">{entry.gut_rating}/100</span>
                          )}
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
                        ? `https://image.tmdb.org/t/p/w154${entry.poster_path}`
                        : null
                      const detailedTotal = (entry.detailed_enjoyment ?? 0) + (entry.detailed_impact ?? 0) + (entry.detailed_recommend ?? 0) + (entry.detailed_watch_again ?? 0)
                      return (
                        <Link
                          key={entry.id}
                          href={`/entries/${entry.id}`}
                          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent transition-colors"
                        >
                          {posterUrl ? (
                            <Image src={posterUrl} alt={entry.title} width={28} height={42} quality={90} className="rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-[28px] h-[42px] rounded bg-muted flex items-center justify-center flex-shrink-0">
                              {entry.media_type === "tv" ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                            </div>
                          )}
                          <span className="text-sm truncate flex-1">{entry.title}</span>
                          <StatusBadge status={entry.status ?? null} mediaType={entry.media_type} />
                          {prefs.score_chips ? (
                            <ScoreChip value={detailedTotal} />
                          ) : (
                            <span className="text-sm font-medium tabular-nums shrink-0">{detailedTotal}/100</span>
                          )}
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
              {prefs.stat_chips ? (
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-rose-500/10">
                  <Clock className="h-5 w-5 text-rose-500" />
                </div>
              ) : (
                <Clock className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="text-2xl font-bold">{movieWatchTime > 0 ? formatMinutes(movieWatchTime) : "—"}</p>
                <p className="text-xs text-muted-foreground">Movies</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              {prefs.stat_chips ? (
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-sky-500/10">
                  <Clock className="h-5 w-5 text-sky-500" />
                </div>
              ) : (
                <Clock className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="text-2xl font-bold">{tvWatchTime > 0 ? formatMinutes(tvWatchTime) : "—"}</p>
                <p className="text-xs text-muted-foreground">TV Shows</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              {prefs.stat_chips ? (
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-emerald-500/10">
                  <Clock className="h-5 w-5 text-emerald-500" />
                </div>
              ) : (
                <Clock className="h-8 w-8 text-muted-foreground" />
              )}
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
