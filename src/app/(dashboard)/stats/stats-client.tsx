"use client"

import { useMemo, useState } from "react"
import { BarChart3, UserCheck, Clock, TrendingUp } from "lucide-react"
import type { FlatEntry } from "@/lib/entry-queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ScoreChip } from "@/components/score-chip"
import { MediaTypeBadge } from "@/components/media-type-badge"
import { useCustomization } from "@/components/customization-provider"

export interface SharedRating {
  media_id: string
  title: string
  media_type: string
  year: number | null
  poster_path: string | null
  viewers: number
  avgGut: number | null
  avgDetailed: number | null
}

type SharedSortKey = "title" | "year" | "viewers" | "avgGut" | "avgDetailed"

interface SharedSort {
  key: SharedSortKey
  dir: 1 | -1
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

function hasDetailed(e: FlatEntry) {
  return e.detailed_enjoyment !== null && e.detailed_impact !== null
}

function detailedTotal(e: FlatEntry): number | null {
  if (!hasDetailed(e)) return null
  return e.detailed_enjoyment! + e.detailed_impact! + e.detailed_recommend! + e.detailed_watch_again!
}

interface GenreStat {
  genre: string
  count: number
  avgGut: number | null
  avgDetailed: number | null
  avgEnjoyment: number | null
  avgImpact: number | null
  avgRecommend: number | null
  avgWatchAgain: number | null
  weightedDetailed: number | null
  best: { title: string; score: number; media_type: string } | null
}

interface DecadeStat {
  decade: string
  count: number
  avgGut: number | null
  avgDetailed: number | null
}

type GenreSortKey = "genre" | "count" | "avgGut" | "avgDetailed" | "avgEnjoyment" | "avgImpact" | "avgRecommend" | "avgWatchAgain" | "weightedDetailed" | "best"

function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`
}

function sortRows<T>(rows: T[], getValue: (row: T) => string | number | null, dir: 1 | -1): T[] {
  return [...rows].sort((a, b) => {
    const av = getValue(a)
    const bv = getValue(b)
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir
    return ((av as number) - (bv as number)) * dir
  })
}

interface StatsPerson {
  id: string
  name: string
}

export function StatsClient({
  self,
  following,
  entriesByUser,
  sharedRatings,
}: {
  self: StatsPerson
  following: StatsPerson[]
  entriesByUser: Record<string, FlatEntry[]>
  sharedRatings: SharedRating[]
}) {
  const [selectedId, setSelectedId] = useState<string>(self.id)
  const [genreSort, setGenreSort] = useState<{ key: GenreSortKey; dir: 1 | -1 }>({ key: "count", dir: -1 })
  const [decadeSort, setDecadeSort] = useState<{ key: "decade" | "count" | "avgGut" | "avgDetailed"; dir: 1 | -1 }>({ key: "decade", dir: -1 })
  const [movieSort, setMovieSort] = useState<SharedSort>({ key: "avgGut", dir: -1 })
  const [tvSort, setTvSort] = useState<SharedSort>({ key: "avgGut", dir: -1 })
  const [moviePage, setMoviePage] = useState(1)
  const [tvPage, setTvPage] = useState(1)

  const { prefs } = useCustomization()

  const entries = useMemo(() => entriesByUser[selectedId] ?? [], [entriesByUser, selectedId])
  const selectedName = selectedId === self.id ? self.name : (following.find((f) => f.id === selectedId)?.name ?? "User")
  const isSelf = selectedId === self.id

  const stats = useMemo(() => {
    const total = entries.length
    const movies = entries.filter((e) => e.media_type === "movie")
    const tv = entries.filter((e) => e.media_type === "tv")

    const gutRatings = entries.filter((e) => e.gut_rating !== null).map((e) => e.gut_rating!)
    const detailedTotals = entries.filter((e) => detailedTotal(e) !== null).map((e) => detailedTotal(e)!)

    const hours = Math.round((entries.reduce((sum, e) => sum + (e.runtime ?? 0), 0) / 60) * 10) / 10

    const genreMap = new Map<string, FlatEntry[]>()
    for (const e of entries) {
      for (const g of e.genres ?? []) {
        const list = genreMap.get(g) ?? []
        list.push(e)
        genreMap.set(g, list)
      }
    }

    const genreStats: GenreStat[] = [...genreMap.entries()]
      .map(([genre, list]) => {
        const detailed = list.filter(hasDetailed)
        const best = detailed.length > 0
          ? detailed.reduce<GenreStat["best"]>((acc, e) => {
              const score = detailedTotal(e)!
              if (!acc || score > acc.score) return { title: e.title, score, media_type: e.media_type }
              return acc
            }, null)
          : null
        return {
          genre,
          count: list.length,
          avgGut: avg(list.filter((e) => e.gut_rating !== null).map((e) => e.gut_rating!)),
          avgDetailed: avg(detailed.map((e) => detailedTotal(e)!)),
          avgEnjoyment: avg(detailed.map((e) => e.detailed_enjoyment!)),
          avgImpact: avg(detailed.map((e) => e.detailed_impact!)),
          avgRecommend: avg(detailed.map((e) => e.detailed_recommend!)),
          avgWatchAgain: avg(detailed.map((e) => e.detailed_watch_again!)),
          weightedDetailed: avg(detailed.map((e) => (detailedTotal(e)! * e.weight) / 100)),
          best,
        }
      })
      .sort((a, b) => b.count - a.count)

    const decadeMap = new Map<string, FlatEntry[]>()
    for (const e of entries) {
      if (e.year == null) continue
      const key = `${Math.floor(e.year / 10) * 10}s`
      const list = decadeMap.get(key) ?? []
      list.push(e)
      decadeMap.set(key, list)
    }

    const decadeStats: DecadeStat[] = [...decadeMap.entries()]
      .map(([decade, list]) => ({
        decade,
        count: list.length,
        avgGut: avg(list.filter((e) => e.gut_rating !== null).map((e) => e.gut_rating!)),
        avgDetailed: avg(list.filter(hasDetailed).map((e) => detailedTotal(e)!)),
      }))
      .sort((a, b) => b.decade.localeCompare(a.decade))

    return { total, movies, tv, gutRatings, detailedTotals, hours, genreStats, decadeStats }
  }, [entries])

  const genreRows = useMemo(() => {
    const getValue = (row: GenreStat): string | number | null =>
      genreSort.key === "best" ? (row.best?.score ?? null) : row[genreSort.key]
    return sortRows(stats.genreStats, getValue, genreSort.dir)
  }, [stats.genreStats, genreSort])
  const decadeRows = useMemo(() => {
    const getValue = (row: DecadeStat): string | number | null => row[decadeSort.key]
    return sortRows(stats.decadeStats, getValue, decadeSort.dir)
  }, [stats.decadeStats, decadeSort])
  const sortShared = (rows: SharedRating[], sort: SharedSort): SharedRating[] => {
    const getValue = (row: SharedRating): string | number | null => (sort.key === "title" ? row.title : row[sort.key])
    return sortRows(rows, getValue, sort.dir)
  }

  const sharedMovies = useMemo(
    () => sortShared(sharedRatings.filter((s) => s.media_type === "movie"), movieSort),
    [sharedRatings, movieSort],
  )
  const sharedTv = useMemo(
    () => sortShared(sharedRatings.filter((s) => s.media_type === "tv"), tvSort),
    [sharedRatings, tvSort],
  )

  const sharedPageSize = 10
  const paginateShared = (rows: SharedRating[], page: number) => {
    const pageCount = Math.max(1, Math.ceil(rows.length / sharedPageSize))
    const safePage = Math.min(page, pageCount)
    return { rows: rows.slice((safePage - 1) * sharedPageSize, safePage * sharedPageSize), page: safePage, pageCount }
  }

  const sharedPager = (rows: SharedRating[], page: number, setPage: (p: number) => void) => {
    const { page: safePage, pageCount } = paginateShared(rows, page)
    if (pageCount <= 1) return null
    const start = (safePage - 1) * sharedPageSize + 1
    const end = Math.min(safePage * sharedPageSize, rows.length)
    return (
      <div className="flex items-center justify-between pt-3">
        <p className="text-xs text-muted-foreground">
          Showing {start}–{end} of {rows.length}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
            Next
          </Button>
        </div>
      </div>
    )
  }

  const noGenres = entries.length > 0 && stats.genreStats.length === 0

  const ratingCell = (value: number | null, max = 100, thresholds?: { green: number; amber: number }) =>
    prefs.score_chips ? (
      <ScoreChip value={value} max={max} thresholds={thresholds} />
    ) : (
      <span className="tabular-nums">{value ?? "—"}</span>
    )

  const quickStatCard = (
    Icon: React.ComponentType<{ className?: string }>,
    iconClass: string,
    chipClass: string,
    value: React.ReactNode,
    label: string,
    subtitle?: string,
  ) => (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 items-center gap-3 pt-6">
        {prefs.stat_chips ? (
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${chipClass}`}>
            <Icon className={`h-5 w-5 ${iconClass}`} />
          </div>
        ) : (
          <Icon className="h-8 w-8 text-muted-foreground" />
        )}
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )

  const genreHeader = (label: string, key: GenreSortKey, align = "right") => (
    <th
      className={`px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => setGenreSort({ key, dir: genreSort.key === key ? (genreSort.dir === 1 ? -1 : 1) : key === "genre" ? 1 : -1 })}
    >
      {label}
      {genreSort.key === key ? (genreSort.dir === 1 ? " ↑" : " ↓") : ""}
    </th>
  )

  const decadeHeader = (label: string, key: "decade" | "count" | "avgGut" | "avgDetailed", align = "right") => (
    <th
      className={`px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => setDecadeSort({ key, dir: decadeSort.key === key ? (decadeSort.dir === 1 ? -1 : 1) : key === "decade" ? -1 : -1 })}
    >
      {label}
      {decadeSort.key === key ? (decadeSort.dir === 1 ? " ↑" : " ↓") : ""}
    </th>
  )

  const toggleSharedSort = (sort: SharedSort, setSort: (s: SharedSort) => void, key: SharedSortKey, resetPage: () => void) => {
    setSort({ key, dir: sort.key === key ? (sort.dir === 1 ? -1 : 1) : key === "title" ? 1 : -1 })
    resetPage()
  }

  const movieHeader = (label: string, key: SharedSortKey, align = "right") => (
    <th
      className={`px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => toggleSharedSort(movieSort, setMovieSort, key, () => setMoviePage(1))}
    >
      {label}
      {movieSort.key === key ? (movieSort.dir === 1 ? " ↑" : " ↓") : ""}
    </th>
  )

  const tvHeader = (label: string, key: SharedSortKey, align = "right") => (
    <th
      className={`px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => toggleSharedSort(tvSort, setTvSort, key, () => setTvPage(1))}
    >
      {label}
      {tvSort.key === key ? (tvSort.dir === 1 ? " ↑" : " ↓") : ""}
    </th>
  )

  const globalStatsSection = (
    <>
      <h2 className="text-lg font-semibold">Global Stats</h2>
      <Card>
        <CardHeader>
          <CardTitle>Average Ratings across BigOleRankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold mb-2">Movies ({sharedMovies.length})</h3>
              {sharedMovies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shared movie ratings yet.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          {movieHeader("Title", "title", "left")}
                          {movieHeader("Year", "year")}
                          {movieHeader("Viewers", "viewers")}
                          {movieHeader("Avg Gut", "avgGut")}
                          {movieHeader("Avg Detailed", "avgDetailed")}
                        </tr>
                      </thead>
                      <tbody>
                        {paginateShared(sharedMovies, moviePage).rows.map((s) => (
                          <tr key={s.media_id} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium truncate max-w-[260px]">{s.title}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.year ?? "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.viewers}</td>
                            <td className="px-3 py-2 text-right">{ratingCell(s.avgGut)}</td>
                            <td className="px-3 py-2 text-right">{ratingCell(s.avgDetailed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sharedPager(sharedMovies, moviePage, setMoviePage)}
                </>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold mb-2">TV shows ({sharedTv.length})</h3>
              {sharedTv.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shared TV show ratings yet.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          {tvHeader("Title", "title", "left")}
                          {tvHeader("Year", "year")}
                          {tvHeader("Viewers", "viewers")}
                          {tvHeader("Avg Gut", "avgGut")}
                          {tvHeader("Avg Detailed", "avgDetailed")}
                        </tr>
                      </thead>
                      <tbody>
                        {paginateShared(sharedTv, tvPage).rows.map((s) => (
                          <tr key={s.media_id} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium truncate max-w-[260px]">{s.title}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.year ?? "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.viewers}</td>
                            <td className="px-3 py-2 text-right">{ratingCell(s.avgGut)}</td>
                            <td className="px-3 py-2 text-right">{ratingCell(s.avgDetailed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sharedPager(sharedTv, tvPage, setTvPage)}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )

  if (entries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <h1 className="text-2xl font-bold">{isSelf ? "Your Stats" : `${possessive(selectedName)} Stats`}</h1>
        </div>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[180px]">
              <UserCheck className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={self.id}>My stats</SelectItem>
              {following.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {isSelf ? (
              <>No ratings yet — add a rating on the <span className="font-medium text-foreground">Dashboard</span> to see your stats.</>
            ) : (
              `${selectedName} has no ratings yet.`
            )}
          </CardContent>
        </Card>
        {globalStatsSection}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <h1 className="text-2xl font-bold">{isSelf ? "Your Stats" : `${possessive(selectedName)} Stats`}</h1>
        </div>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-[180px]">
            <UserCheck className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={self.id}>My stats</SelectItem>
            {following.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStatCard(
          BarChart3,
          "text-sky-500",
          "bg-sky-500/10",
          stats.total,
          "Total rated",
          `${stats.movies.length} movie${stats.movies.length === 1 ? "" : "s"} · ${stats.tv.length} TV`,
        )}
        {quickStatCard(Clock, "text-cyan-500", "bg-cyan-500/10", stats.hours, "Time watched", "hours of runtime")}
        {quickStatCard(TrendingUp, "text-amber-500", "bg-amber-500/10", avg(stats.gutRatings) ?? "—", "Avg gut rating")}
        {quickStatCard(TrendingUp, "text-emerald-500", "bg-emerald-500/10", avg(stats.detailedTotals) ?? "—", "Avg detailed")}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By genre</CardTitle>
        </CardHeader>
        <CardContent>
          {noGenres ? (
            <p className="text-sm text-muted-foreground">
              No genre data yet. Run the migration in <code className="text-xs bg-muted px-1.5 py-0.5 rounded">supabase-migration.sql</code> and then{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">npx tsx scripts/backfill-genres.ts</code> to backfill existing entries.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    {genreHeader("Genre", "genre", "left")}
                    {genreHeader("Count", "count")}
                    {genreHeader("Avg Gut", "avgGut")}
                    {genreHeader("Avg Detailed", "avgDetailed")}
                    {genreHeader("Enjoyment", "avgEnjoyment")}
                    {genreHeader("Impact", "avgImpact")}
                    {genreHeader("Recommend", "avgRecommend")}
                    {genreHeader("Watch Again", "avgWatchAgain")}
                    {genreHeader("Best Pick", "best", "left")}
                  </tr>
                </thead>
                <tbody>
                  {genreRows.map((g) => (
                    <tr key={g.genre} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{g.genre}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.count}</td>
                      <td className="px-3 py-2 text-right">{ratingCell(g.avgGut)}</td>
                      <td className="px-3 py-2 text-right">{ratingCell(g.avgDetailed)}</td>
                      <td className="px-3 py-2 text-right">{ratingCell(g.avgEnjoyment, 60)}</td>
                      <td className="px-3 py-2 text-right">{ratingCell(g.avgImpact, 20, { green: 14, amber: 7 })}</td>
                      <td className="px-3 py-2 text-right">{ratingCell(g.avgRecommend, 10, { green: 7.5, amber: 4.5 })}</td>
                      <td className="px-3 py-2 text-right">{ratingCell(g.avgWatchAgain, 10, { green: 7.5, amber: 4.5 })}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {g.best ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-medium">{g.best.title}</span>
                            {prefs.media_badges ? (
                              <MediaTypeBadge type={g.best.media_type} />
                            ) : (
                              <span className="text-xs text-muted-foreground">{g.best.media_type === "tv" ? "TV Show" : "Movie"}</span>
                            )}
                            {ratingCell(g.best.score)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>By decade</CardTitle>
          </CardHeader>
          <CardContent>
            {decadeRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No release years on record.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    {decadeHeader("Decade", "decade", "left")}
                    {decadeHeader("Count", "count")}
                    {decadeHeader("Avg Gut", "avgGut")}
                    {decadeHeader("Avg Detailed", "avgDetailed")}
                  </tr>
                </thead>
                <tbody>
                  {decadeRows.map((d) => (
                    <tr key={d.decade} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{d.decade}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.count}</td>
                      <td className="px-3 py-2 text-right">{ratingCell(d.avgGut)}</td>
                      <td className="px-3 py-2 text-right">{ratingCell(d.avgDetailed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Movie vs TV</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-left">Type</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Count</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Avg Gut</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Avg Detailed</th>
                </tr>
              </thead>
              <tbody>
                {(["movie", "tv"] as const).map((type) => {
                  const list = stats[type === "movie" ? "movies" : "tv"]
                  return (
                    <tr key={type} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium capitalize">{type === "movie" ? "Movie" : "TV show"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{list.length}</td>
                      <td className="px-3 py-2 text-right">
                        {ratingCell(avg(list.filter((e) => e.gut_rating !== null).map((e) => e.gut_rating!)))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {ratingCell(avg(list.filter(hasDetailed).map((e) => detailedTotal(e)!)))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {globalStatsSection}
    </div>
  )
}
