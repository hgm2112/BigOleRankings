"use client"

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts"
import { Tv } from "lucide-react"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { USER_1_COLOR, USER_2_COLOR } from "@/components/charts/chart-colors"
import { correlationLabel, type SeasonAgreement } from "@/lib/compare-stats"
import { symmetricDomain } from "./taste-charts"
import {
  DnfHelp,
  DnfOverlapHelp,
  SeasonByShowHelp,
  SeasonCorrHelp,
  SeasonGapHelp,
  SeasonNHelp,
  SeasonSectionHelp,
} from "./metric-help"

function Metric({
  value,
  label,
  sub,
  help,
}: {
  value: React.ReactNode
  label: string
  sub?: string
  help?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {help}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function SeasonAgreementSection({
  season,
  nameA,
  nameB,
}: {
  season: SeasonAgreement
  nameA: string
  nameB: string
}) {
  if (season.n === 0 && season.dnfTotalA + season.dnfTotalB === 0) return null

  const config = {
    a: { label: `${nameA} higher`, color: USER_1_COLOR },
    b: { label: `${nameB} higher`, color: USER_2_COLOR },
  }

  const showData = [...season.byShow]
    .sort((x, y) => x.signed - y.signed)
    .slice(0, 12)

  const { domain, ticks } = symmetricDomain(showData.map((d) => d.signed))

  const dnfTotal = season.bothDnf + season.onlyADnf + season.onlyBDnf

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Tv className="h-5 w-5" />
          Season-by-Season Agreement
          <SeasonSectionHelp nameA={nameA} nameB={nameB} />
        </CardTitle>
        <CardDescription>
          Per-season 1–10 ratings and DNFs on shows you both watched
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric
            value={season.n}
            label="Shared season ratings"
            sub={season.n < 3 ? "need 3+ for correlation" : undefined}
            help={<SeasonNHelp n={season.n} />}
          />
          <Metric
            value={season.pearson === null ? "—" : season.pearson.toFixed(2)}
            label="Season correlation"
            sub={correlationLabel(season.pearson)}
            help={
              <SeasonCorrHelp
                pearson={season.pearson}
                label={correlationLabel(season.pearson)}
                n={season.n}
              />
            }
          />
          <Metric
            value={season.mad ?? "—"}
            label="Avg season gap"
            sub="points on the 1–10 scale"
            help={<SeasonGapHelp mad={season.mad} nameA={nameA} nameB={nameB} />}
          />
          <Metric
            value={`${season.bothDnf}/${dnfTotal || 0}`}
            label="DNFs you both quit"
            sub={`${season.dnfTotalA} vs ${season.dnfTotalB} total DNFs`}
            help={<DnfHelp both={season.bothDnf} totalA={season.dnfTotalA} totalB={season.dnfTotalB} />}
          />
        </div>

        {showData.length > 0 && (
          <div>
            <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              Where you disagree, by show
              <SeasonByShowHelp nameA={nameA} nameB={nameB} />
            </h4>
            <p className="mb-2 text-xs text-muted-foreground">
              Average signed gap per season — right means {nameA} is higher, left means {nameB} is higher.
            </p>
            <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(200, showData.length * 30) }}>
              <BarChart data={showData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" domain={domain} ticks={ticks} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="title" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 11 }} />
                  <ReferenceLine x={0} stroke="var(--muted-foreground)" />
                  <ChartTooltip
                    content={(props) => <SeasonShowTooltip {...props} nameA={nameA} nameB={nameB} />}
                  />
                  <Bar dataKey="signed" radius={[0, 3, 3, 0]} maxBarSize={18}>
                    {showData.map((row) => (
                      <Cell key={row.media_id} fill={row.signed >= 0 ? "var(--color-a)" : "var(--color-b)"} />
                    ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        )}

        {dnfTotal > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              DNF overlap
              <DnfOverlapHelp nameA={nameA} nameB={nameB} />
            </h4>
            <div className="space-y-2">
              {[
                { label: "Both quit the same season", count: season.bothDnf, color: "bg-chart-3" },
                { label: `Only ${nameA} quit`, count: season.onlyADnf, color: "bg-chart-1" },
                { label: `Only ${nameB} quit`, count: season.onlyBDnf, color: "bg-chart-2" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-56 shrink-0 text-xs text-muted-foreground">{row.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.count / dnfTotal) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs font-semibold tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SeasonShowTooltip({
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
  const row = (payload[0] as { payload?: { title: string; signed: number; n: number; mad: number } } | undefined)?.payload
  if (!row) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{row.title}</p>
      <p className="text-muted-foreground">
        {row.signed > 0 ? nameA : row.signed < 0 ? nameB : "Neither"} rates seasons{" "}
        <span className="tabular-nums text-foreground">{Math.abs(row.signed)}</span> higher
      </p>
      <p className="text-muted-foreground">
        Avg gap <span className="tabular-nums text-foreground">{row.mad}</span> · {row.n} season{row.n === 1 ? "" : "s"}
      </p>
    </div>
  )
}
