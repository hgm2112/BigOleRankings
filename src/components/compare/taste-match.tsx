"use client"

import { useMemo } from "react"
import { Activity, BarChart3, GitCompareArrows, Handshake, Target, Tv } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  computeComparison,
  computeSeasonAgreement,
  correlationLabel,
  scoreLabel,
  type ComparisonStats,
  type SeasonRatingRow,
} from "@/lib/compare-stats"
import type { FlatEntry } from "@/lib/entry-queries"
import {
  DimensionDeltaBars,
  DimensionRadarChart,
  GenreAgreementChart,
  PredictionChart,
  TasteScatterChart,
} from "./taste-charts"
import { RatingDistributionChart } from "@/components/charts/rating-distribution"
import { USER_1_COLOR, USER_2_COLOR } from "@/components/charts/chart-colors"
import { ExtremesLists } from "./extremes-lists"
import { SeasonAgreementSection } from "./season-agreement"
import {
  AverageGapHelp,
  AvgGutHelp,
  BiasHelp,
  DetailedProfileHelp,
  DimAvgGapHelp,
  DimBarsHelp,
  DimCorrHelp,
  DimNHelp,
  DistributionHelp,
  GenreHelp,
  GutCorrelationHelp,
  MatchScoreHelp,
  MovieTvHelp,
  PredictionHelp,
  ScatterHelp,
  TopOverlapHelp,
  Within10Help,
} from "./metric-help"

function Kpi({
  icon,
  iconClass,
  value,
  label,
  sub,
  help,
}: {
  icon: React.ReactNode
  iconClass: string
  value: React.ReactNode
  label: string
  sub?: string
  help?: React.ReactNode
}) {
  return (
    <Card className="flex-1">
      <CardContent className="flex items-center gap-3 pt-6">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <div className="flex items-center gap-2">
            <p className="min-w-0 text-xs leading-tight text-muted-foreground">{label}</p>
            {help}
          </div>
          {sub && <p className="text-xs leading-tight text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function MatchRing({ score, label, help }: { score: number; label: string; help?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative h-24 w-24 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(var(--chart-1) ${Math.max(0, Math.min(100, score)) * 3.6}deg, var(--muted) 0deg)`,
        }}
      >
        <div className="absolute inset-[6px] flex flex-col items-center justify-center rounded-full bg-card">
          <span className="text-2xl font-bold tabular-nums">{score}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">match</span>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold">{label}</p>
          {help}
        </div>
        <p className="text-sm text-muted-foreground">100 minus the average gut-rating gap</p>
      </div>
    </div>
  )
}

function DimensionTable({ stats, nameA, nameB }: { stats: ComparisonStats; nameA: string; nameB: string }) {
  const rows = stats.dimensions.filter((d) => d.n > 0)
  if (rows.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr className="text-xs text-muted-foreground">
            <th className="px-2 py-2 text-left font-medium">Dimension</th>
            <th className="px-2 py-2 text-right font-medium">{nameA}</th>
            <th className="px-2 py-2 text-right font-medium">{nameB}</th>
            <th className="px-2 py-2 text-right font-medium">
              <span className="flex items-center justify-end gap-2">
                Avg gap
                <DimAvgGapHelp nameA={nameA} nameB={nameB} />
              </span>
            </th>
            <th className="px-2 py-2 text-right font-medium">
              <span className="flex items-center justify-end gap-2">
                Corr.
                <DimCorrHelp nameA={nameA} nameB={nameB} />
              </span>
            </th>
            <th className="px-2 py-2 text-right font-medium">
              <span className="flex items-center justify-end gap-2">
                n
                <DimNHelp nameA={nameA} nameB={nameB} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
              <tr key={d.key} className="border-b last:border-0">
                <td className="px-2 py-2 font-medium">
                  {d.label} <span className="text-xs font-normal text-muted-foreground">/{d.max}</span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: USER_1_COLOR }}>
                  {d.avgA ?? "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: USER_2_COLOR }}>
                  {d.avgB ?? "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{d.mad ?? "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {d.pearson === null ? "—" : d.pearson.toFixed(2)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{d.n}</td>
              </tr>
          ))}
        </tbody>
      </table>
      <p className="pt-2 text-xs text-muted-foreground">
        Signed bias:{" "}
        {(() => {
          const dom = [...rows]
            .filter((r) => r.signed !== null)
            .sort((a, b) => Math.abs(b.signed ?? 0) - Math.abs(a.signed ?? 0))[0]
          if (!dom) return "—"
          const signed = dom.signed ?? 0
          return `${dom.label} — ${signed > 0 ? nameA : nameB} is ${Math.abs(signed)} points ${
            signed > 0 ? "higher" : "lower"
          } on average`
        })()}
      </p>
    </div>
  )
}

export function TasteMatchSection({
  entriesA,
  entriesB,
  nameA,
  nameB,
  userIdA,
  userIdB,
  seasonRows,
}: {
  entriesA: FlatEntry[]
  entriesB: FlatEntry[]
  nameA: string
  nameB: string
  userIdA: string
  userIdB: string
  seasonRows: SeasonRatingRow[]
}) {
  const stats = useMemo(() => computeComparison(entriesA, entriesB), [entriesA, entriesB])

  const scatterPoints = useMemo(() => {
    const mapB = new Map(entriesB.map((e) => [e.media_id, e]))
    const points: { x: number; y: number; title: string; media_type: string }[] = []
    for (const a of entriesA) {
      if (a.gut_rating === null) continue
      const b = mapB.get(a.media_id)
      if (!b || b.gut_rating === null) continue
      points.push({ x: a.gut_rating, y: b.gut_rating, title: a.title, media_type: a.media_type })
    }
    return points
  }, [entriesA, entriesB])

  const season = useMemo(() => {
    const titleByMediaId = new Map(
      entriesA.filter((e) => e.media_type === "tv").map((e) => [e.media_id, { title: e.title, media_type: e.media_type }]),
    )
    return computeSeasonAgreement(seasonRows, userIdA, userIdB, titleByMediaId)
  }, [seasonRows, userIdA, userIdB, entriesA])

  if (stats.shared === 0) return null

  const { gut } = stats
  const signed = gut.meanSigned
  const fightsOver20 = stats.extremes.fights.filter((f) => Math.abs(f.delta) >= 20).length
  const harsher =
    signed === null || signed === 0 ? "You rate each other the same on average" : signed > 0 ? `${nameA} rates higher` : `${nameB} rates higher`

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Handshake className="h-5 w-5" />
          Taste Match
        </h2>
        <p className="text-sm text-muted-foreground">
          How much you agree, how you score the detailed breakdown, and what your ratings predict about theirs.
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <Card className="lg:w-[340px]">
          <CardContent className="pt-6">
            <MatchRing
              score={gut.matchScore ?? 0}
              label={scoreLabel(gut.matchScore)}
              help={<MatchScoreHelp score={gut.matchScore ?? 0} label={scoreLabel(gut.matchScore)} n={gut.n} />}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Shared titles</p>
                <p className="font-semibold tabular-nums">
                  {stats.shared} <span className="font-normal text-muted-foreground">· {stats.jaccard}% overlap</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Only {nameA}</p>
                <p className="font-semibold tabular-nums">{stats.onlyA}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Only {nameB}</p>
                <p className="font-semibold tabular-nums">{stats.onlyB}</p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">Bias</p>
                  <BiasHelp signed={signed} nameA={nameA} nameB={nameB} />
                </div>
                <p className="truncate font-semibold" title={harsher}>
                  {signed === null || signed === 0 ? "Neutral" : `${signed > 0 ? "+" : ""}${signed}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi
            icon={<GitCompareArrows className="h-5 w-5" />}
            iconClass="bg-chart-1/10 text-chart-1"
            value={gut.pearson === null ? "—" : gut.pearson.toFixed(2)}
            label="Gut correlation"
            sub={`${correlationLabel(gut.pearson)} · ρ ${gut.spearman === null ? "—" : gut.spearman.toFixed(2)}`}
            help={
              <GutCorrelationHelp
                pearson={gut.pearson}
                spearman={gut.spearman}
                label={correlationLabel(gut.pearson)}
                n={gut.n}
              />
            }
          />
          <Kpi
            icon={<Target className="h-5 w-5" />}
            iconClass="bg-chart-2/10 text-chart-2"
            value={gut.mad ?? "—"}
            label="Average gap"
            sub={`${gut.medianAbsDiff ?? "—"} median · ${gut.exactMatches} exact`}
            help={
              <AverageGapHelp
                mad={gut.mad}
                median={gut.medianAbsDiff}
                exact={gut.exactMatches}
                n={gut.n}
                nameA={nameA}
                nameB={nameB}
              />
            }
          />
          <Kpi
            icon={<Activity className="h-5 w-5" />}
            iconClass="bg-chart-4/10 text-chart-4"
            value={`${gut.pctWithin10 ?? 0}%`}
            label="Within 10 points"
            sub={`${gut.pctWithin5 ?? 0}% within 5 · ${gut.hotTakes} hot takes`}
            help={<Within10Help pct10={gut.pctWithin10 ?? 0} pct5={gut.pctWithin5 ?? 0} hotTakes={gut.hotTakes} n={gut.n} />}
          />
          <Kpi
            icon={<BarChart3 className="h-5 w-5" />}
            iconClass="bg-chart-3/10 text-chart-3"
            value={`${gut.avgA ?? "—"} / ${gut.avgB ?? "—"}`}
            label="Average gut rating"
            sub={`${nameA} / ${nameB}`}
            help={<AvgGutHelp avgA={gut.avgA} avgB={gut.avgB} nameA={nameA} nameB={nameB} />}
          />
          <Kpi
            icon={<Tv className="h-5 w-5" />}
            iconClass="bg-chart-5/10 text-chart-5"
            value={`${stats.byType.movie?.pearson?.toFixed(2) ?? "—"} / ${stats.byType.tv?.pearson?.toFixed(2) ?? "—"}`}
            label="Movie / TV correlation"
            sub={`Avg gap ${stats.byType.movie?.mad ?? "—"} / ${stats.byType.tv?.mad ?? "—"}`}
            help={
              <MovieTvHelp
                movieR={stats.byType.movie?.pearson ?? null}
                tvR={stats.byType.tv?.pearson ?? null}
                movieMad={stats.byType.movie?.mad ?? null}
                tvMad={stats.byType.tv?.mad ?? null}
              />
            }
          />
          <Kpi
            icon={<Handshake className="h-5 w-5" />}
            iconClass="bg-green-600/10 text-green-600"
            value={`${stats.extremes.topOverlap.count}/10`}
            label="Top-10 overlap"
            sub={`${fightsOver20} fights over 20 pts`}
            help={<TopOverlapHelp count={stats.extremes.topOverlap.count} fightsOver20={fightsOver20} />}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            Do you see eye to eye?
            <ScatterHelp nameA={nameA} nameB={nameB} n={gut.n} />
          </CardTitle>
          <CardDescription>
            Every shared title — below the dashed line {nameA} was higher, above it {nameB} was.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TasteScatterChart points={scatterPoints} nameA={nameA} nameB={nameB} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Detailed profile
              <DetailedProfileHelp nameA={nameA} nameB={nameB} />
            </CardTitle>
            <CardDescription>
              Enjoyment /60, Impact /20, Recommend /10, Watch Again /10 — shown as % of each dimension&apos;s max
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DimensionRadarChart dimensions={stats.dimensions} nameA={nameA} nameB={nameB} />
            <DimensionTable stats={stats} nameA={nameA} nameB={nameB} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Average by dimension
              <DimBarsHelp nameA={nameA} nameB={nameB} />
            </CardTitle>
            <CardDescription>
              {stats.detailedN} shared title{stats.detailedN === 1 ? "" : "s"} with detailed ratings from both
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.detailedN > 0 ? (
              <>
                <DimensionDeltaBars dimensions={stats.dimensions} nameA={nameA} nameB={nameB} />
                <p className="text-xs text-muted-foreground">
                  Raw averages — {nameA} vs {nameB}. Values are on each dimension&apos;s own scale, not normalized.
                </p>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Neither of you has filled in a detailed rating the other has too.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Rating distribution
              <DistributionHelp nameA={nameA} nameB={nameB} />
            </CardTitle>
            <CardDescription>How each of you spreads your gut scores</CardDescription>
          </CardHeader>
          <CardContent>
            <RatingDistributionChart
              buckets={stats.distribution}
              series={[
                { key: "a", label: nameA, color: USER_1_COLOR, values: stats.distribution.map((d) => d.a) },
                { key: "b", label: nameB, color: USER_2_COLOR, values: stats.distribution.map((d) => d.b) },
              ]}
              height={260}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              If I rated it X, what do they give it?
              <PredictionHelp
                nameA={nameA}
                nameB={nameB}
                slope={stats.prediction.regression.slope}
                r2={stats.prediction.regression.r2}
                n={gut.n}
              />
            </CardTitle>
            <CardDescription>
              {stats.prediction.regression.slope === null
                ? "Bucketed averages of both users' gut ratings"
                : `Each +10 from ${nameA} → +${Math.round(stats.prediction.regression.slope * 10)} from ${nameB} (R² ${
                    stats.prediction.regression.r2 === null ? "—" : stats.prediction.regression.r2.toFixed(2)
                  })`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PredictionChart
              buckets={stats.prediction.buckets}
              regression={stats.prediction.regression}
              nameA={nameA}
              nameB={nameB}
            />
            <p className="text-xs text-muted-foreground">
              Dashed grey line = perfect agreement. Blue line = least-squares fit across all {gut.n} shared titles.
            </p>
            {stats.prediction.buckets.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th className="py-1.5 text-left font-medium">{nameA} rated</th>
                      <th className="py-1.5 text-right font-medium">Titles</th>
                      <th className="py-1.5 text-right font-medium">{nameB} averaged</th>
                      <th className="py-1.5 text-right font-medium">Enj.</th>
                      <th className="py-1.5 text-right font-medium">Imp.</th>
                      <th className="py-1.5 text-right font-medium">Rec.</th>
                      <th className="py-1.5 text-right font-medium">Again</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.prediction.buckets.map((b) => (
                      <tr key={b.label} className="border-b last:border-0">
                        <td className="py-1.5 font-medium tabular-nums">{b.label}</td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">{b.n}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums" style={{ color: USER_2_COLOR }}>
                          {b.avgB ?? "—"}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{b.dims.enjoyment ?? "—"}</td>
                        <td className="py-1.5 text-right tabular-nums">{b.dims.impact ?? "—"}</td>
                        <td className="py-1.5 text-right tabular-nums">{b.dims.recommend ?? "—"}</td>
                        <td className="py-1.5 text-right tabular-nums">{b.dims.watch_again ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            Where your tastes split, by genre
            <GenreHelp nameA={nameA} nameB={nameB} />
          </CardTitle>
          <CardDescription>
            Average signed gut gap per genre — right of zero means {nameA} is the bigger fan, left means {nameB} is
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.genres.length > 0 ? (
            <GenreAgreementChart genres={stats.genres} nameA={nameA} nameB={nameB} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Not enough shared genre data yet — each genre needs at least 2 shared titles.
            </p>
          )}
        </CardContent>
      </Card>

      <ExtremesLists
        agreements={stats.extremes.agreements}
        fights={stats.extremes.fights}
        topOverlap={stats.extremes.topOverlap}
        nameA={nameA}
        nameB={nameB}
      />

      <SeasonAgreementSection season={season} nameA={nameA} nameB={nameB} />
    </div>
  )
}
