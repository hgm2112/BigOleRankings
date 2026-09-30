"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { CHART_3, USER_1_COLOR, USER_2_COLOR } from "@/components/charts/chart-colors"
import type { ComparisonStats, DimensionStat } from "@/lib/compare-stats"

/* ------------------------------------------------------------------ scatter */

interface ScatterPoint {
  x: number
  y: number
  title: string
  media_type: string
}

export function TasteScatterChart({
  points,
  nameA,
  nameB,
}: {
  points: ScatterPoint[]
  nameA: string
  nameB: string
}) {
  const higherA = points.filter((p) => p.x > p.y)
  const higherB = points.filter((p) => p.y > p.x)
  const tied = points.filter((p) => p.x === p.y)

  const config = {
    a: { label: `${nameA} higher`, color: USER_1_COLOR },
    b: { label: `${nameB} higher`, color: USER_2_COLOR },
    tie: { label: "Tied", color: CHART_3 },
  }

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 320 }}>
      <ScatterChart margin={{ top: 10, right: 16, left: 14, bottom: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="x"
            name={nameA}
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            label={{ value: nameA, position: "insideBottom", offset: -4, fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={nameB}
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            width={44}
            label={{ value: nameB, angle: -90, position: "insideLeft", offset: 8, fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
          />
          <ChartTooltip
            cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }}
            content={(props) => <ScatterTooltipContent {...props} nameA={nameA} nameB={nameB} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Scatter name={`${nameA} higher`} data={higherA} fill="var(--color-a)" fillOpacity={0.85} />
          <Scatter name={`${nameB} higher`} data={higherB} fill="var(--color-b)" fillOpacity={0.85} />
        <Scatter name="Tied" data={tied} fill="var(--color-tie)" fillOpacity={0.85} />
      </ScatterChart>
    </ChartContainer>
  )
}

function ScatterTooltipContent({
  active,
  payload,
  nameA,
  nameB,
}: {
  active?: boolean
  payload?: readonly unknown[]
  nameA: string
  nameB: string
}) {
  if (!active || !payload?.length) return null
  const point = (payload[0] as { payload?: ScatterPoint } | undefined)?.payload
  if (!point) return null
  const delta = point.x - point.y
  return (
    <div className="max-w-[220px] rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <p className="truncate font-medium">{point.title}</p>
      <div className="mt-1 flex items-center gap-3 tabular-nums text-muted-foreground">
        <span style={{ color: USER_1_COLOR }}>
          {nameA}: {point.x}
        </span>
        <span style={{ color: USER_2_COLOR }}>
          {nameB}: {point.y}
        </span>
        <span className={delta > 0 ? "text-green-600" : delta < 0 ? "text-destructive" : ""}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- radar */

export function DimensionRadarChart({
  dimensions,
  nameA,
  nameB,
}: {
  dimensions: DimensionStat[]
  nameA: string
  nameB: string
}) {
  const data = dimensions
    .filter((d) => d.pctA !== null && d.pctB !== null)
    .map((d) => ({
      dimension: d.label,
      a: d.pctA,
      b: d.pctB,
      max: d.max,
      rawA: d.avgA,
      rawB: d.avgB,
    }))

  const config = {
    a: { label: nameA, color: USER_1_COLOR },
    b: { label: nameB, color: USER_2_COLOR },
  }

  if (data.length === 0) return null

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 300 }}>
      <RadarChart data={data} margin={{ top: 10, right: 40, left: 40, bottom: 10 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <ChartTooltip content={(props) => <RadarTooltipContent {...props} nameA={nameA} nameB={nameB} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Radar name={nameA} dataKey="a" stroke="var(--color-a)" fill="var(--color-a)" fillOpacity={0.25} />
        <Radar name={nameB} dataKey="b" stroke="var(--color-b)" fill="var(--color-b)" fillOpacity={0.25} />
      </RadarChart>
    </ChartContainer>
  )
}

function RadarTooltipContent({
  active,
  payload,
  nameA,
  nameB,
}: {
  active?: boolean
  payload?: readonly unknown[]
  nameA: string
  nameB: string
}) {
  if (!active || !payload?.length) return null
  const row = (payload[0] as
    | { payload?: { dimension: string; max: number; rawA: number | null; rawB: number | null } }
    | undefined)?.payload
  if (!row) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">
        {row.dimension} <span className="font-normal text-muted-foreground">/ {row.max}</span>
      </p>
      <p className="tabular-nums" style={{ color: USER_1_COLOR }}>
        {nameA}: {row.rawA ?? "—"}
      </p>
      <p className="tabular-nums" style={{ color: USER_2_COLOR }}>
        {nameB}: {row.rawB ?? "—"}
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- prediction */

export function PredictionChart({
  buckets,
  regression,
  nameA,
  nameB,
}: {
  buckets: ComparisonStats["prediction"]["buckets"]
  regression: ComparisonStats["prediction"]["regression"]
  nameA: string
  nameB: string
}) {
  if (buckets.length < 2) return null

  const data = buckets.map((b) => ({
    mid: Math.round((b.rangeMin + b.rangeMax) / 2),
    label: b.label,
    n: b.n,
    a: b.avgA,
    b: b.avgB ?? 0,
  }))

  const config = {
    a: { label: nameA, color: USER_1_COLOR },
    b: { label: nameB, color: USER_2_COLOR },
  }

  const regressionSegment:
    | [{ x: number; y: number }, { x: number; y: number }]
    | null =
    regression.slope === null || regression.intercept === null
      ? null
      : [
          { x: 0, y: Math.max(0, Math.min(100, regression.intercept)) },
          { x: 100, y: Math.max(0, Math.min(100, regression.intercept + regression.slope * 100)) },
        ]

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 300 }}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -14, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="mid"
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            label={{ value: `${nameA} rating`, position: "insideBottom", offset: -4, fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            width={44}
          />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
          />
          {regressionSegment && (
            <ReferenceLine
              segment={regressionSegment}
              stroke={CHART_3}
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          )}
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line type="monotone" dataKey="a" name={nameA} stroke="var(--color-a)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="b" name={nameB} stroke="var(--color-b)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6}} />
      </LineChart>
    </ChartContainer>
  )
}

/* -------------------------------------------------------------------- genre */

export function GenreAgreementChart({
  genres,
  nameA,
  nameB,
}: {
  genres: ComparisonStats["genres"]
  nameA: string
  nameB: string
}) {
  if (genres.length === 0) return null

  const data = [...genres]
    .sort((a, b) => a.signed - b.signed)
    .slice(0, 14)
    .map((g) => ({ genre: g.genre, signed: g.signed, n: g.n, mad: g.mad }))

  const { domain, ticks } = symmetricDomain(data.map((d) => d.signed))

  const config = {
    a: { label: `${nameA} higher`, color: USER_1_COLOR },
    b: { label: `${nameB} higher`, color: USER_2_COLOR },
  }

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(220, data.length * 28) }}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" domain={domain} ticks={ticks} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="genre"
            tickLine={false}
            axisLine={false}
            width={92}
            tick={{ fontSize: 11 }}
          />
          <ReferenceLine x={0} stroke="var(--muted-foreground)" />
          <ChartTooltip content={(props) => <GenreTooltipContent {...props} nameA={nameA} nameB={nameB} />} />
          <Bar dataKey="signed" radius={[0, 3, 3, 0]} maxBarSize={18}>
            {data.map((row) => (
              <Cell key={row.genre} fill={row.signed >= 0 ? "var(--color-a)" : "var(--color-b)"} />
            ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function GenreTooltipContent({
  active,
  payload,
  nameA,
  nameB,
}: {
  active?: boolean
  payload?: readonly unknown[]
  nameA: string
  nameB: string
}) {
  if (!active || !payload?.length) return null
  const row = (payload[0] as { payload?: { genre: string; signed: number; n: number; mad: number } } | undefined)?.payload
  if (!row) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{row.genre}</p>
      <p className="text-muted-foreground">
        {row.signed > 0 ? nameA : row.signed < 0 ? nameB : "Neither"} rates it{" "}
        <span className="tabular-nums text-foreground">{Math.abs(row.signed)}</span> higher on average
      </p>
      <p className="text-muted-foreground">
        Avg gap <span className="tabular-nums text-foreground">{row.mad}</span> · {row.n} shared title{row.n === 1 ? "" : "s"}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------- helpers */

export function symmetricDomain(values: number[]): { domain: [number, number]; ticks: number[] } {
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)))
  const limit = Math.ceil(maxAbs)
  const step = Math.max(1, Math.ceil((limit * 2) / 6))
  const ticks: number[] = []
  for (let v = -limit; v <= limit; v += step) ticks.push(v)
  if (!ticks.includes(0)) ticks.push(0)
  if (!ticks.includes(limit)) ticks.push(limit)
  if (!ticks.includes(-limit)) ticks.push(-limit)
  ticks.sort((a, b) => a - b)
  return { domain: [-limit, limit], ticks: [...new Set(ticks)] }
}

/* -------------------------------------------------------- dimension bars */

export function DimensionDeltaBars({
  dimensions,
  nameA,
  nameB,
}: {
  dimensions: DimensionStat[]
  nameA: string
  nameB: string
}) {
  const data = dimensions
    .filter((d) => d.avgA !== null && d.avgB !== null)
    .map((d) => ({
      label: d.label,
      a: d.avgA ?? 0,
      b: d.avgB ?? 0,
      max: d.max,
      n: d.n,
      pctA: d.pctA ?? 0,
      pctB: d.pctB ?? 0,
      signed: d.signed ?? 0,
      pearson: d.pearson,
      mad: d.mad,
    }))

  if (data.length === 0) return null

  const config = {
    a: { label: nameA, color: USER_1_COLOR },
    b: { label: nameB, color: USER_2_COLOR },
  }

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 260 }}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }} barGap={3}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={44} />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="a" name={nameA} fill="var(--color-a)" radius={[3, 3, 0, 0]} maxBarSize={34} />
        <Bar dataKey="b" name={nameB} fill="var(--color-b)" radius={[3, 3, 0, 0]} maxBarSize={34} />
      </BarChart>
    </ChartContainer>
  )
}
