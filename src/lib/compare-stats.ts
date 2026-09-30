// Pure comparison statistics for two users' rating sets.
// No React, no Supabase — takes FlatEntry[] pairs and returns numbers the UI renders.

import type { FlatEntry } from "./entry-queries"

export interface ComparePair {
  a: FlatEntry
  b: FlatEntry
}

export interface AgreementStats {
  n: number
  pearson: number | null
  spearman: number | null
  mad: number | null
  medianAbsDiff: number | null
  meanSigned: number | null
  pctWithin5: number | null
  pctWithin10: number | null
  pctWithin20: number | null
  exactMatches: number
  hotTakes: number
  matchScore: number | null
  avgA: number | null
  avgB: number | null
}

export type DimensionKey = "enjoyment" | "impact" | "recommend" | "watch_again"

export interface DimensionStat {
  key: DimensionKey
  label: string
  max: number
  n: number
  avgA: number | null
  avgB: number | null
  pctA: number | null
  pctB: number | null
  pearson: number | null
  mad: number | null
  signed: number | null
}

export interface PredictionBucket {
  label: string
  rangeMin: number
  rangeMax: number
  n: number
  avgA: number
  avgB: number | null
  dims: Record<DimensionKey, number | null>
}

export interface RegressionStat {
  slope: number | null
  intercept: number | null
  r2: number | null
  n: number
}

export interface GenreAgreement {
  genre: string
  n: number
  mad: number
  signed: number
}

export interface DistributionBucket {
  label: string
  rangeMin: number
  rangeMax: number
  a: number
  b: number
}

export interface ExtremesItem {
  media_id: string
  title: string
  media_type: string
  year: number | null
  poster_path: string | null
  a: number
  b: number
  delta: number
}

export interface TopOverlap {
  count: number
  items: ExtremesItem[]
}

export interface SeasonPair {
  media_id: string
  title: string
  season_number: number
  a: number | null
  b: number | null
  dnfA: boolean
  dnfB: boolean
}

export interface SeasonAgreement {
  n: number
  pearson: number | null
  mad: number | null
  meanSigned: number | null
  bothDnf: number
  onlyADnf: number
  onlyBDnf: number
  dnfTotalA: number
  dnfTotalB: number
  pairs: SeasonPair[]
  byShow: { media_id: string; title: string; n: number; mad: number; signed: number }[]
}

export interface ComparisonStats {
  shared: number
  onlyA: number
  onlyB: number
  jaccard: number
  gut: AgreementStats
  byType: { movie: AgreementStats | null; tv: AgreementStats | null }
  dimensions: DimensionStat[]
  detailedN: number
  prediction: { buckets: PredictionBucket[]; regression: RegressionStat }
  genres: GenreAgreement[]
  distribution: DistributionBucket[]
  extremes: { agreements: ExtremesItem[]; fights: ExtremesItem[]; topOverlap: TopOverlap }
}

export interface SeasonRatingRow {
  user_id: string
  media_id: string
  season_number: number
  rating: number | null
  dnf: boolean
}

/* ------------------------------------------------------------------ math */

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 3) return null
  const mx = mean(xs)
  const my = mean(ys)
  if (mx === null || my === null) return null
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const ax = xs[i] - mx
    const ay = ys[i] - my
    num += ax * ay
    dx += ax * ax
    dy += ay * ay
  }
  if (dx === 0 || dy === 0) return null
  return num / Math.sqrt(dx * dy)
}

function ranks(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }))
  indexed.sort((a, b) => a.value - b.value)
  const out = new Array<number>(values.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) j++
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[indexed[k].index] = avgRank
    i = j + 1
  }
  return out
}

function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length < 3) return null
  return pearson(ranks(xs), ranks(ys))
}

function linearRegression(xs: number[], ys: number[]): RegressionStat {
  const n = xs.length
  if (n < 3) return { slope: null, intercept: null, r2: null, n }
  const mx = mean(xs)
  const my = mean(ys)
  if (mx === null || my === null) return { slope: null, intercept: null, r2: null, n }
  let cov = 0
  let varX = 0
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my)
    varX += (xs[i] - mx) ** 2
  }
  if (varX === 0) return { slope: null, intercept: null, r2: null, n }
  const slope = cov / varX
  const intercept = my - slope * mx
  const r = pearson(xs, ys)
  return { slope, intercept, r2: r === null ? null : r * r, n }
}

function round(value: number | null, digits = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/* ------------------------------------------------------------ agreement */

function gutAgreement(aValues: number[], bValues: number[]): AgreementStats {
  const n = aValues.length
  const abs = aValues.map((v, i) => Math.abs(v - bValues[i]))
  const signed = aValues.map((v, i) => v - bValues[i])
  const mad = mean(abs)
  return {
    n,
    pearson: round(pearson(aValues, bValues), 3),
    spearman: round(spearman(aValues, bValues), 3),
    mad: round(mad),
    medianAbsDiff: round(median(abs)),
    meanSigned: round(mean(signed)),
    pctWithin5: n ? Math.round((abs.filter((d) => d <= 5).length / n) * 100) : null,
    pctWithin10: n ? Math.round((abs.filter((d) => d <= 10).length / n) * 100) : null,
    pctWithin20: n ? Math.round((abs.filter((d) => d <= 20).length / n) * 100) : null,
    exactMatches: abs.filter((d) => d === 0).length,
    hotTakes: abs.filter((d) => d >= 20).length,
    matchScore: mad === null ? null : Math.max(0, Math.min(100, Math.round(100 - mad))),
    avgA: round(mean(aValues)),
    avgB: round(mean(bValues)),
  }
}

/* ----------------------------------------------------------- dimensions */

const DIMENSIONS: { key: DimensionKey; label: string; max: number; pick: (e: FlatEntry) => number | null }[] = [
  { key: "enjoyment", label: "Enjoyment", max: 60, pick: (e) => e.detailed_enjoyment },
  { key: "impact", label: "Impact", max: 20, pick: (e) => e.detailed_impact },
  { key: "recommend", label: "Recommend", max: 10, pick: (e) => e.detailed_recommend },
  { key: "watch_again", label: "Watch Again", max: 10, pick: (e) => e.detailed_watch_again },
]

export const DIMENSION_DEFS = DIMENSIONS

/* ---------------------------------------------------------- prediction */

const GUT_BUCKETS = [
  { label: "1–40", rangeMin: 1, rangeMax: 40 },
  { label: "41–60", rangeMin: 41, rangeMax: 60 },
  { label: "61–75", rangeMin: 61, rangeMax: 75 },
  { label: "76–85", rangeMin: 76, rangeMax: 85 },
  { label: "86–100", rangeMin: 86, rangeMax: 100 },
]

const GUT_DISTRIBUTION_BUCKETS = Array.from({ length: 10 }, (_, i) => {
  const rangeMin = i * 10 + 1
  const rangeMax = i * 10 + 10
  return { label: `${rangeMin}–${rangeMax}`, rangeMin, rangeMax }
})

/* ---------------------------------------------------------- top-level */

function toItem(pair: ComparePair): ExtremesItem {
  const { a, b } = pair
  return {
    media_id: a.media_id,
    title: a.title,
    media_type: a.media_type,
    year: a.year,
    poster_path: a.poster_path,
    a: a.gut_rating ?? 0,
    b: b.gut_rating ?? 0,
    delta: (a.gut_rating ?? 0) - (b.gut_rating ?? 0),
  }
}

export function buildPairs(entriesA: FlatEntry[], entriesB: FlatEntry[]): ComparePair[] {
  const mapB = new Map(entriesB.map((e) => [e.media_id, e]))
  const pairs: ComparePair[] = []
  for (const a of entriesA) {
    const b = mapB.get(a.media_id)
    if (b) pairs.push({ a, b })
  }
  return pairs
}

export function computeComparison(
  entriesA: FlatEntry[],
  entriesB: FlatEntry[],
): ComparisonStats {
  const pairs = buildPairs(entriesA, entriesB)
  const idsA = new Set(entriesA.map((e) => e.media_id))
  const idsB = new Set(entriesB.map((e) => e.media_id))
  let union = 0
  for (const id of idsA) if (!idsB.has(id)) union++
  union += idsB.size

  const gutPairs = pairs.filter((p) => p.a.gut_rating !== null && p.b.gut_rating !== null)
  const aGut = gutPairs.map((p) => p.a.gut_rating!)
  const bGut = gutPairs.map((p) => p.b.gut_rating!)

  const moviePairs = gutPairs.filter((p) => p.a.media_type === "movie")
  const tvPairs = gutPairs.filter((p) => p.a.media_type === "tv")

  const detailedPairs = pairs.filter((p) => p.a.detailed_enjoyment !== null && p.b.detailed_enjoyment !== null)

  const dimensions: DimensionStat[] = DIMENSIONS.map((dim) => {
    const rows = detailedPairs.filter((p) => dim.pick(p.a) !== null && dim.pick(p.b) !== null)
    const xs = rows.map((p) => dim.pick(p.a)!)
    const ys = rows.map((p) => dim.pick(p.b)!)
    const avgA = mean(xs)
    const avgB = mean(ys)
    const abs = xs.map((v, i) => Math.abs(v - ys[i]))
    const signed = xs.map((v, i) => v - ys[i])
    return {
      key: dim.key,
      label: dim.label,
      max: dim.max,
      n: rows.length,
      avgA: round(avgA),
      avgB: round(avgB),
      pctA: avgA === null ? null : Math.round((avgA / dim.max) * 100),
      pctB: avgB === null ? null : Math.round((avgB / dim.max) * 100),
      pearson: round(pearson(xs, ys), 3),
      mad: round(mean(abs)),
      signed: round(mean(signed)),
    }
  })

  const buckets: PredictionBucket[] = GUT_BUCKETS.map((bucket) => {
    const rows = gutPairs.filter((p) => p.a.gut_rating! >= bucket.rangeMin && p.a.gut_rating! <= bucket.rangeMax)
    const avgA = mean(rows.map((p) => p.a.gut_rating!))
    const avgB = mean(rows.map((p) => p.b.gut_rating!))
    const dims = {} as Record<DimensionKey, number | null>
    for (const dim of DIMENSIONS) {
      const sub = rows.filter((p) => dim.pick(p.a) !== null && dim.pick(p.b) !== null)
      dims[dim.key] = round(mean(sub.map((p) => dim.pick(p.b)!)))
    }
    return {
      ...bucket,
      n: rows.length,
      avgA: avgA ?? 0,
      avgB: round(avgB),
      dims,
    }
  }).filter((b) => b.n > 0)

  const genreMap = new Map<string, ComparePair[]>()
  for (const pair of gutPairs) {
    for (const genre of pair.a.genres ?? []) {
      const list = genreMap.get(genre) ?? []
      list.push(pair)
      genreMap.set(genre, list)
    }
  }
  const genres: GenreAgreement[] = [...genreMap.entries()]
    .map(([genre, rows]) => {
      const abs = rows.map((p) => Math.abs(p.a.gut_rating! - p.b.gut_rating!))
      const signed = rows.map((p) => p.a.gut_rating! - p.b.gut_rating!)
      return {
        genre,
        n: rows.length,
        mad: round(mean(abs)) ?? 0,
        signed: round(mean(signed)) ?? 0,
      }
    })
    .filter((g) => g.n >= 2)
    .sort((x, y) => y.n - x.n)

  const countA = (min: number, max: number) =>
    aGut.filter((v) => v >= min && v <= max).length
  const countB = (min: number, max: number) =>
    bGut.filter((v) => v >= min && v <= max).length
  const distribution: DistributionBucket[] = GUT_DISTRIBUTION_BUCKETS.map((bucket) => ({
    ...bucket,
    a: countA(bucket.rangeMin, bucket.rangeMax),
    b: countB(bucket.rangeMin, bucket.rangeMax),
  }))

  const byAbs = [...gutPairs].sort((x, y) => {
    const dx = Math.abs(x.a.gut_rating! - x.b.gut_rating!)
    const dy = Math.abs(y.a.gut_rating! - y.b.gut_rating!)
    if (dx !== dy) return dx - dy
    return (y.a.gut_rating! + y.b.gut_rating!) - (x.a.gut_rating! + x.b.gut_rating!)
  })
  const agreements = byAbs.slice(0, 6).map(toItem)
  const fights = [...byAbs].reverse().slice(0, 6).map(toItem)

  const topA = new Set([...gutPairs].sort((x, y) => y.a.gut_rating! - x.a.gut_rating!).slice(0, 10).map((p) => p.a.media_id))
  const topB = new Set([...gutPairs].sort((x, y) => y.b.gut_rating! - x.b.gut_rating!).slice(0, 10).map((p) => p.b.media_id))
  const overlapItems = gutPairs
    .filter((p) => topA.has(p.a.media_id) && topB.has(p.b.media_id))
    .map(toItem)
    .sort((x, y) => y.a - x.a)

  return {
    shared: pairs.length,
    onlyA: idsA.size - pairs.length,
    onlyB: idsB.size - pairs.length,
    jaccard: union > 0 ? Math.round((pairs.length / union) * 100) : 0,
    gut: gutAgreement(aGut, bGut),
    byType: {
      movie: moviePairs.length >= 2 ? gutAgreement(moviePairs.map((p) => p.a.gut_rating!), moviePairs.map((p) => p.b.gut_rating!)) : null,
      tv: tvPairs.length >= 2 ? gutAgreement(tvPairs.map((p) => p.a.gut_rating!), tvPairs.map((p) => p.b.gut_rating!)) : null,
    },
    dimensions,
    detailedN: detailedPairs.length,
    prediction: {
      buckets,
      regression: linearRegression(aGut, bGut),
    },
    genres,
    distribution,
    extremes: {
      agreements,
      fights,
      topOverlap: { count: overlapItems.length, items: overlapItems },
    },
  }
}

/* ------------------------------------------------------ season ratings */

export function computeSeasonAgreement(
  rows: SeasonRatingRow[],
  userIdA: string,
  userIdB: string,
  titleByMediaId: Map<string, { title: string; media_type: string }>,
): SeasonAgreement {
  const byKey = new Map<string, SeasonPair>()
  for (const row of rows) {
    const media = titleByMediaId.get(row.media_id)
    if (!media || media.media_type !== "tv") continue
    const key = `${row.media_id}:${row.season_number}`
    let pair = byKey.get(key)
    if (!pair) {
      pair = { media_id: row.media_id, title: media.title, season_number: row.season_number, a: null, b: null, dnfA: false, dnfB: false }
      byKey.set(key, pair)
    }
    if (row.user_id === userIdA) {
      pair.a = row.rating
      pair.dnfA = row.dnf
    } else if (row.user_id === userIdB) {
      pair.b = row.rating
      pair.dnfB = row.dnf
    }
  }

  const pairs = [...byKey.values()]
  const rated = pairs.filter((p) => p.a !== null && p.b !== null)
  const xs = rated.map((p) => p.a!)
  const ys = rated.map((p) => p.b!)
  const abs = xs.map((v, i) => Math.abs(v - ys[i]))
  const signed = xs.map((v, i) => v - ys[i])

  const showMap = new Map<string, { title: string; n: number; absSum: number; signedSum: number }>()
  rated.forEach((p) => {
    const entry = showMap.get(p.media_id) ?? { title: p.title, n: 0, absSum: 0, signedSum: 0 }
    entry.n++
    entry.absSum += Math.abs(p.a! - p.b!)
    entry.signedSum += p.a! - p.b!
    showMap.set(p.media_id, entry)
  })
  const byShow = [...showMap.entries()]
    .map(([media_id, e]) => ({
      media_id,
      title: e.title,
      n: e.n,
      mad: Math.round((e.absSum / e.n) * 10) / 10,
      signed: Math.round((e.signedSum / e.n) * 10) / 10,
    }))
    .sort((x, y) => y.n - x.n)

  return {
    n: rated.length,
    pearson: round(pearson(xs, ys), 3),
    mad: round(mean(abs)),
    meanSigned: round(mean(signed)),
    bothDnf: pairs.filter((p) => p.dnfA && p.dnfB).length,
    onlyADnf: pairs.filter((p) => p.dnfA && !p.dnfB).length,
    onlyBDnf: pairs.filter((p) => !p.dnfA && p.dnfB).length,
    dnfTotalA: pairs.filter((p) => p.dnfA).length,
    dnfTotalB: pairs.filter((p) => p.dnfB).length,
    pairs,
    byShow,
  }
}

/* -------------------------------------------------------------- labels */

export function correlationLabel(r: number | null): string {
  if (r === null) return "Not enough data"
  if (r >= 0.85) return "Twin flames"
  if (r >= 0.65) return "Very similar taste"
  if (r >= 0.45) return "Some overlap"
  if (r >= 0.2) return "Occasional agreement"
  if (r >= 0) return "Barely related"
  return "Complete opposites"
}

export function scoreLabel(score: number | null): string {
  if (score === null) return "—"
  if (score >= 90) return "Scary close"
  if (score >= 80) return "In sync"
  if (score >= 70) return "Friendly overlap"
  if (score >= 55) return "Agree to disagree"
  return "Frenemies"
}
