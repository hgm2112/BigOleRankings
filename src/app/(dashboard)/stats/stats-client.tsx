"use client"

import { useMemo, useState } from "react"
import { BarChart3 } from "lucide-react"
import type { FlatEntry } from "@/lib/entry-queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
  best: { title: string; score: number } | null
}

interface DecadeStat {
  decade: string
  count: number
  avgGut: number | null
  avgDetailed: number | null
}

type GenreSortKey = "genre" | "count" | "avgGut" | "avgDetailed" | "avgEnjoyment" | "avgImpact" | "avgRecommend" | "avgWatchAgain" | "weightedDetailed" | "best"

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

export function StatsClient({ entries }: { entries: FlatEntry[] }) {
  const [genreSort, setGenreSort] = useState<{ key: GenreSortKey; dir: 1 | -1 }>({ key: "count", dir: -1 })
  const [decadeSort, setDecadeSort] = useState<{ key: "decade" | "count" | "avgGut" | "avgDetailed"; dir: 1 | -1 }>({ key: "decade", dir: -1 })

  const stats = useMemo(() => {
    const total = entries.length
    const withDetailed = entries.filter(hasDetailed).length
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
              if (!acc || score > acc.score) return { title: e.title, score }
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

    return { total, withDetailed, movies, tv, gutRatings, detailedTotals, hours, genreStats, decadeStats }
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

  const noGenres = entries.length > 0 && stats.genreStats.length === 0

  const formatPct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`)

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

  if (entries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <h1 className="text-2xl font-bold">Stats</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No ratings yet — add a rating on the <span className="font-medium text-foreground">Dashboard</span> to see your stats.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Stats</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total rated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.movies.length} movie{stats.movies.length === 1 ? "" : "s"} · {stats.tv.length} TV
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg gut rating</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{avg(stats.gutRatings) ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">/ 100</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg detailed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{avg(stats.detailedTotals) ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">/ 100 · {formatPct(stats.withDetailed, stats.total)} detailed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Time watched</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.hours}</p>
            <p className="text-xs text-muted-foreground mt-1">hours of runtime</p>
          </CardContent>
        </Card>
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
                      <td className="px-3 py-2 text-right tabular-nums">{g.avgGut ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.avgDetailed ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.avgEnjoyment ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.avgImpact ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.avgRecommend ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.avgWatchAgain ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{g.best ? `${g.best.title} (${g.best.score})` : "—"}</td>
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
                      <td className="px-3 py-2 text-right tabular-nums">{d.avgGut ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.avgDetailed ?? "—"}</td>
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
                      <td className="px-3 py-2 text-right tabular-nums">
                        {avg(list.filter((e) => e.gut_rating !== null).map((e) => e.gut_rating!)) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {avg(list.filter(hasDetailed).map((e) => detailedTotal(e)!)) ?? "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
