"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

export interface DistributionSeries {
  key: string
  label: string
  color: string
  values: number[]
}

export function RatingDistributionChart({
  buckets,
  series,
  height = 260,
  showLegend = true,
}: {
  buckets: { label: string }[]
  series: DistributionSeries[]
  height?: number
  showLegend?: boolean
}) {
  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  )

  const data = buckets.map((bucket, i) => ({
    label: bucket.label,
    ...Object.fromEntries(series.map((s) => [s.key, s.values[i] ?? 0])),
  }))

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
            tick={{ fontSize: 10 }}
          />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          {showLegend && series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={[3, 3, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
