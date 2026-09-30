"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { RatingDistributionChart } from "@/components/charts/rating-distribution"
import { CHART_1, CHART_2, CHART_3, CHART_4, CHART_5 } from "@/components/charts/chart-colors"
import type { FlatEntry } from "@/lib/entry-queries"

const DIMENSION_DEFS = [
  { key: "enjoyment", label: "Enjoyment", max: 60, field: "detailed_enjoyment" as const },
  { key: "impact", label: "Impact", max: 20, field: "detailed_impact" as const },
  { key: "recommend", label: "Recommend", max: 10, field: "detailed_recommend" as const },
  { key: "watch_again", label: "Watch Again", max: 10, field: "detailed_watch_again" as const },
]

function round1(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Math.round(value * 10) / 10
}

export function StatsCharts({ entries }: { entries: FlatEntry[] }) {
  const data = useMemo(() => {
    const gutValues = entries.filter((e) => e.gut_rating !== null).map((e) => e.gut_rating!)

    const distribution = Array.from({ length: 10 }, (_, i) => {
      const min = i * 10 + 1
      const max = i * 10 + 10
      return {
        label: `${min}–${max}`,
        count: gutValues.filter((v) => v >= min && v <= max).length,
      }
    })

    const monthMap = new Map<string, { count: number; sum: number; gutted: number }>()
    for (const e of entries) {
      const raw = e.gut_rated_at ?? e.created_at
      if (!raw) continue
      const key = raw.slice(0, 7)
      const bucket = monthMap.get(key) ?? { count: 0, sum: 0, gutted: 0 }
      bucket.count++
      if (e.gut_rating !== null) {
        bucket.sum += e.gut_rating
        bucket.gutted++
      }
      monthMap.set(key, bucket)
    }
    const overTime = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, b]) => ({
        label: month,
        count: b.count,
        avgGut: b.gutted > 0 ? round1(b.sum / b.gutted) : null,
      }))

    const dimensionAvgs = DIMENSION_DEFS.map((dim) => {
      const rows = entries.filter((e) => e[dim.field] !== null)
      const avg = rows.length > 0 ? rows.reduce((sum, e) => sum + (e[dim.field] ?? 0), 0) / rows.length : null
      return {
        label: dim.label,
        max: dim.max,
        n: rows.length,
        raw: round1(avg),
        pct: avg === null ? 0 : Math.round((avg / dim.max) * 100),
      }
    }).filter((d) => d.n > 0)

    const genreMap = new Map<string, { count: number; sum: number }>()
    for (const e of entries) {
      if (e.gut_rating === null) continue
      for (const g of e.genres ?? []) {
        const bucket = genreMap.get(g) ?? { count: 0, sum: 0 }
        bucket.count++
        bucket.sum += e.gut_rating
        genreMap.set(g, bucket)
      }
    }
    const topGenres = [...genreMap.entries()]
      .filter(([, b]) => b.count >= 3)
      .map(([genre, b]) => ({ genre, count: b.count, avgGut: round1(b.sum / b.count) ?? 0 }))
      .sort((a, b) => b.avgGut - a.avgGut)
      .slice(0, 12)
      .reverse()

    const typeSplit = (["movie", "tv"] as const).map((type) => {
      const rows = entries.filter((e) => e.media_type === type && e.gut_rating !== null)
      return {
        label: type === "movie" ? "Movies" : "TV Shows",
        count: rows.length,
        avgGut: rows.length > 0 ? round1(rows.reduce((s, e) => s + (e.gut_rating ?? 0), 0) / rows.length) ?? 0 : 0,
      }
    })

    return { distribution, overTime, dimensionAvgs, topGenres, typeSplit }
  }, [entries])

  const hasGut = entries.some((e) => e.gut_rating !== null)
  const hasTime = data.overTime.length >= 2
  const hasGenres = data.topGenres.length > 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {hasGut && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rating spread</CardTitle>
              <CardDescription>How your gut scores are distributed</CardDescription>
            </CardHeader>
            <CardContent>
              <RatingDistributionChart
                buckets={data.distribution}
                series={[
                  { key: "count", label: "Ratings", color: CHART_1, values: data.distribution.map((d) => d.count) },
                ]}
                showLegend={false}
                height={240}
              />
            </CardContent>
          </Card>
        )}

        {hasTime && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rating activity</CardTitle>
              <CardDescription>Ratings per month and your average that month</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{ count: { label: "Ratings", color: CHART_1 }, avgGut: { label: "Avg gut", color: CHART_5 } }}
                className="aspect-auto w-full"
                style={{ height: 240 }}
              >
                  <ComposedChart data={data.overTime} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="count" tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                    <YAxis yAxisId="gut" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={34} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar yAxisId="count" dataKey="count" name="Ratings" fill="var(--color-count)" radius={[3, 3, 0, 0]} maxBarSize={24} />
                    <Line
                      yAxisId="gut"
                      dataKey="avgGut"
                      name="Avg gut"
                      stroke="var(--color-avgGut)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.dimensionAvgs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detailed breakdown</CardTitle>
              <CardDescription>Average score per dimension, as % of its maximum</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ChartContainer
                config={{ pct: { label: "% of max", color: CHART_4 } }}
                className="aspect-auto w-full"
                style={{ height: 240 }}
              >
                  <BarChart data={data.dimensionAvgs} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={44} />
                    <ChartTooltip content={<DimensionTooltip />} />
                    <Bar dataKey="pct" name="% of max" fill="var(--color-pct)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
              </ChartContainer>
              <div className="grid grid-cols-4 gap-2 text-center">
                {data.dimensionAvgs.map((d) => (
                  <div key={d.label} className="rounded-md bg-muted/50 px-1 py-1.5">
                    <p className="text-sm font-semibold tabular-nums">
                      {d.raw}
                      <span className="text-xs font-normal text-muted-foreground">/{d.max}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">{d.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Movie vs TV</CardTitle>
            <CardDescription>Average gut rating by media type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartContainer config={{ avgGut: { label: "Avg gut", color: CHART_2 } }} className="aspect-auto w-full" style={{ height: 200 }}>
                <BarChart data={data.typeSplit} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={44} />
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                  <Bar dataKey="avgGut" name="Avg gut" fill="var(--color-avgGut)" radius={[4, 4, 0, 0]} maxBarSize={72} />
                </BarChart>
            </ChartContainer>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {data.typeSplit.map((t) => (
                <div key={t.label} className="rounded-md border border-border px-3 py-2">
                  <p className="font-semibold tabular-nums">{t.avgGut || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.count} {t.label.toLowerCase()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {hasGenres && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Highest-rated genres</CardTitle>
            <CardDescription>Average gut rating — genres with at least 3 ratings</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ avgGut: { label: "Avg gut", color: CHART_3 } }} className="aspect-auto w-full" style={{ height: Math.max(220, data.topGenres.length * 32) }}>
                <BarChart data={data.topGenres} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="genre" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={(props) => <GenreTooltip {...props} />} />
                  <Bar dataKey="avgGut" name="Avg gut" fill="var(--color-avgGut)" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DimensionTooltip(props: {
  active?: boolean
  payload?: readonly unknown[]
}) {
  if (!props.active || !props.payload?.length) return null
  const row = (props.payload[0] as { payload?: { label: string; raw: number | null; max: number; n: number } } | undefined)?.payload
  if (!row) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{row.label}</p>
      <p className="tabular-nums text-muted-foreground">
        {row.raw} / {row.max} ({row.n} rated)
      </p>
    </div>
  )
}

function GenreTooltip(props: {
  active?: boolean
  payload?: readonly unknown[]
}) {
  if (!props.active || !props.payload?.length) return null
  const row = (props.payload[0] as { payload?: { genre: string; avgGut: number; count: number } } | undefined)?.payload
  if (!row) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{row.genre}</p>
      <p className="tabular-nums text-muted-foreground">
        {row.avgGut} avg · {row.count} ratings
      </p>
    </div>
  )
}

export function SharedRatingsChart({
  items,
}: {
  items: { media_id: string; title: string; viewers: number; avgGut: number | null }[]
}) {
  const data = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.viewers - a.viewers)
        .slice(0, 12)
        .map((i) => ({ title: i.title.length > 24 ? `${i.title.slice(0, 22)}…` : i.title, viewers: i.viewers, avgGut: i.avgGut ?? 0 }))
        .reverse(),
    [items],
  )

  if (data.length === 0) return null

  return (
    <ChartContainer config={{ viewers: { label: "Ratings", color: CHART_5 } }} className="aspect-auto w-full" style={{ height: Math.max(220, data.length * 32) }}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="title" tickLine={false} axisLine={false} width={200} tick={{ fontSize: 10 }} />
          <ChartTooltip content={(props) => <SharedTooltip {...props} />} />
          <Bar dataKey="viewers" name="Ratings" fill="var(--color-viewers)" radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
    </ChartContainer>
  )
}

function SharedTooltip(props: { active?: boolean; payload?: readonly unknown[] }) {
  if (!props.active || !props.payload?.length) return null
  const row = (props.payload[0] as { payload?: { title: string; viewers: number; avgGut: number } } | undefined)?.payload
  if (!row) return null
  return (
    <div className="max-w-[240px] rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{row.title}</p>
      <p className="tabular-nums text-muted-foreground">
        {row.viewers} ratings · {row.avgGut || "—"} avg gut
      </p>
    </div>
  )
}
