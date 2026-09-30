"use client"

import type { ReactNode } from "react"

import { InfoButton } from "@/components/info-button"

/**
 * Every explainer lives inside a flex container with `gap-2` — the trigger uses
 * `-m-2 p-2` so the 30px touch target on phone doesn't add any layout width.
 *
 * Copy is contextual: `def` is what the metric means, `reading` is where *these*
 * two users actually stand, built from the live values at the call site.
 */
function Body({ title, def, reading }: { title: string; def: ReactNode; reading?: ReactNode }) {
  return (
    <>
      <p className="font-medium">{title}</p>
      <p className="leading-relaxed text-muted-foreground">{def}</p>
      {reading && <p className="border-t border-border pt-1.5 leading-relaxed">{reading}</p>}
    </>
  )
}

function fmt(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return digits === 0 ? `${Math.round(value)}` : value.toFixed(digits)
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

function biasReading(signed: number | null, nameA: string, nameB: string): ReactNode {
  if (signed === null) return "Not enough shared titles rated by both of you yet."
  if (signed === 0) return `${nameA} and ${nameB} score identically on average — perfectly neutral.`
  const higher = signed > 0 ? nameA : nameB
  const lower = signed > 0 ? nameB : nameA
  const amount = Math.abs(signed)
  const verdict =
    amount <= 1
      ? "essentially neutral — neither of you is the harsher grader"
      : amount <= 5
        ? "a mild lean, not a real disagreement about how hard you each grade"
        : "a genuine difference in how harshly each of you grades"
  return (
    <>
      {higher} runs {fmt(amount)} point{amount === 1 ? "" : "s"} higher than {lower} out of 100 — {verdict}.
    </>
  )
}

function gapReading(mad: number | null, nameA: string, nameB: string): ReactNode {
  if (mad === null) return "Not enough shared titles rated by both of you yet."
  const verdict =
    mad <= 5
      ? "you give near-identical scores"
      : mad <= 12
        ? "you mostly agree, with room for the occasional disagreement"
        : mad <= 20
          ? "you agree on the broad strokes but not the exact score"
          : "you are usually far apart on the same title"
  return (
    <>
      {nameA} and {nameB} sit {fmt(mad, 1)} points apart on average — {verdict}.
    </>
  )
}

/* ------------------------------------------------------------ Taste Match */

export function MatchScoreHelp({ score, label, n }: { score: number; label: string; n: number }) {
  return (
    <InfoButton label="Match score">
      <Body
        title="Match score"
        def="100 minus the average absolute gut-rating gap on your shared titles, clamped to 0–100. It measures how close you land on the same number — not whether you rank things in the same order."
        reading={
          <>
            {score} → <span className="font-medium">{label}</span>, averaged over {plural(n, "shared title")}.
          </>
        }
      />
    </InfoButton>
  )
}

export function BiasHelp({ signed, nameA, nameB }: { signed: number | null; nameA: string; nameB: string }) {
  return (
    <InfoButton label="Bias">
      <Body
        title="Bias"
        def={
          <>
            Signed average of ({nameA} − {nameB}) across shared titles on the 1–100 gut scale. Unlike the average gap it
            keeps the direction: positive means {nameA} grades higher, negative means {nameB} does.
          </>
        }
        reading={biasReading(signed, nameA, nameB)}
      />
    </InfoButton>
  )
}

export function GutCorrelationHelp({
  pearson,
  spearman,
  label,
  n,
}: {
  pearson: number | null
  spearman: number | null
  label: string
  n: number
}) {
  return (
    <InfoButton label="Gut correlation">
      <Body
        title="Gut correlation"
        def="Pearson correlation of your 1–100 gut ratings on shared titles. It asks whether the titles one of you rates higher are also the titles the other rates higher, regardless of whether you use the same numbers."
        reading={
          <>
            <span className="font-medium">{fmt(pearson)}</span> — {label}. Rank-order ρ is {fmt(spearman)}, across{" "}
            {plural(n, "shared title")}. When Pearson leads Spearman you agree on the order <em>and</em> on the
            scale.
          </>
        }
      />
    </InfoButton>
  )
}

export function AverageGapHelp({
  mad,
  median,
  exact,
  n,
  nameA,
  nameB,
}: {
  mad: number | null
  median: number | null
  exact: number
  n: number
  nameA: string
  nameB: string
}) {
  return (
    <InfoButton label="Average gap">
      <Body
        title="Average gap"
        def={
          <>
            Mean absolute difference between your gut ratings, on the 1–100 scale. Direction is thrown away — Bias tells
            you who is higher, this only says how far apart you are.
          </>
        }
        reading={
          <>
            {gapReading(mad, nameA, nameB)} Median gap {fmt(median, 1)} · {plural(exact, "exact match")} ·{" "}
            {plural(n, "shared title")} counted.
          </>
        }
      />
    </InfoButton>
  )
}

export function Within10Help({
  pct10,
  pct5,
  hotTakes,
  n,
}: {
  pct10: number
  pct5: number
  hotTakes: number
  n: number
}) {
  return (
    <InfoButton label="Within 10 points">
      <Body
        title="Within 10 points"
        def="Share of shared titles where your gut ratings land within 10 points of each other. Hot takes are titles where you are more than 20 points apart — the ones worth arguing about."
        reading={
          <>
            {pct10}% within 10 points, {pct5}% within 5, across {plural(n, "shared title")}. {plural(hotTakes, "hot take")}
            .
          </>
        }
      />
    </InfoButton>
  )
}

export function AvgGutHelp({
  avgA,
  avgB,
  nameA,
  nameB,
}: {
  avgA: number | null
  avgB: number | null
  nameA: string
  nameB: string
}) {
  const verdict =
    avgA === null || avgB === null
      ? ""
      : Math.abs(avgA - avgB) <= 0.5
        ? " — you are just as hard to please as each other"
        : avgA > avgB
          ? ` — ${nameA} is the more generous grader`
          : ` — ${nameB} is the more generous grader`
  return (
    <InfoButton label="Average gut rating">
      <Body
        title="Average gut rating"
        def="Each person's mean gut rating across all titles they have rated (shared or not). It says how harsh a grader each of you is overall, independent of whether you agree title by title."
        reading={
          <>
            {nameA} {fmt(avgA, 1)} · {nameB} {fmt(avgB, 1)}{verdict}.
          </>
        }
      />
    </InfoButton>
  )
}

export function MovieTvHelp({
  movieR,
  tvR,
  movieMad,
  tvMad,
}: {
  movieR: number | null
  tvR: number | null
  movieMad: number | null
  tvMad: number | null
}) {
  const verdict =
    movieR === null || tvR === null
      ? "You don't have enough shared titles in both formats to compare yet."
      : Math.abs(movieR - tvR) < 0.1
        ? "Your agreement is format-independent — films and shows are equally comfortable territory."
        : movieR > tvR
          ? "You agree far more on films than on shows."
          : "You agree far more on shows than on films."
  return (
    <InfoButton label="Movie / TV correlation">
      <Body
        title="Movie / TV correlation"
        def="The same gut correlation computed separately on your shared movies and your shared TV shows. The overall number can hide a format split, so this tells you where your agreement actually comes from."
        reading={
          <>
            Movies {fmt(movieR)} (gap {fmt(movieMad, 1)}) · TV {fmt(tvR)} (gap {fmt(tvMad, 1)}). {verdict}
          </>
        }
      />
    </InfoButton>
  )
}

export function TopOverlapHelp({
  count,
  fightsOver20,
}: {
  count: number
  fightsOver20: number
}) {
  return (
    <InfoButton label="Top-10 overlap">
      <Body
        title="Top-10 overlap"
        def="How many titles appear in both of your personal top 10 (ranked by gut rating). The fight count is the number of shared titles you are more than 20 points apart on."
        reading={
          <>
            {count} of 10 titles shared · {plural(fightsOver20, "fight")} over 20 points.
          </>
        }
      />
    </InfoButton>
  )
}

/* ------------------------------------------------- Detailed profile table */

export function DimAvgGapHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="Avg gap">
      <Body
        title="Avg gap"
        def={
          <>
            Mean absolute difference for this dimension on the dimension&apos;s own scale — Enjoyment /60, Impact /20,
            Recommend /10, Watch Again /10. These are raw scores, not converted to 1–100 like the gut rating.
          </>
        }
        reading={
          <>
            It is computed only from titles where both {nameA} and {nameB} filled this dimension in, so each row uses
            its own sample.
          </>
        }
      />
    </InfoButton>
  )
}

export function DimCorrHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="Corr.">
      <Body
        title="Corr."
        def="Pearson correlation for this one dimension — do the titles you rate high on Enjoyment also get rated high by the other person? Separate from the overall gut correlation above."
        reading={
          <>
            Each row is computed over its own set of shared titles (the n column on the right). Values need at least 3
            paired scores; below that this shows —. The four rows can legitimately differ: {nameA} and {nameB} might
            lock-step on Recommend while diverging on Watch Again.
          </>
        }
      />
    </InfoButton>
  )
}

export function DimNHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="n">
      <Body
        title="n"
        def="The number of shared titles where both people filled in this specific dimension."
        reading={
          <>
            The count differs row by row because either {nameA} or {nameB} can save some dimensions without others — so
            every Avg gap and Corr. figure is over its own sample, not one common set.
          </>
        }
      />
    </InfoButton>
  )
}

/* ------------------------------------------------------------ card titles */

export function ScatterHelp({ nameA, nameB, n }: { nameA: string; nameB: string; n: number }) {
  return (
    <InfoButton label="Do you see eye to eye?">
      <Body
        title="Do you see eye to eye?"
        def={
          <>
            One dot per shared title. Horizontal is {nameA}&apos;s gut rating, vertical is {nameB}&apos;s. Dots on the dashed
            diagonal are exact agreement; the further off it, the wider the argument.
          </>
        }
        reading={
          <>
            {plural(n, "shared title")} plotted. A tight cluster along the diagonal is the shape of a high gut
            correlation.
          </>
        }
      />
    </InfoButton>
  )
}

export function DetailedProfileHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="Detailed profile">
      <Body
        title="Detailed profile"
        def="Your four-way breakdown of each title — Enjoyment /60, Impact /20, Recommend /10, Watch Again /10 — averaged per person and plotted as % of each dimension's maximum, with a table underneath."
        reading={
          <>
            Read the table as: your averages, the gap between them, how tightly the two of you track (Corr.), and the
            sample size (n) behind each row. Anything with a small n is a weak signal. {nameA} and {nameB} only
            contribute where both filled the dimension in.
          </>
        }
      />
    </InfoButton>
  )
}

export function DimBarsHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="Average by dimension">
      <Body
        title="Average by dimension"
        def="Raw mean score per dimension for each person, drawn side by side so you can see which side of the breakdown each of you leans towards."
        reading={
          <>
            Values stay on each dimension&apos;s own scale, so Enjoyment bars will always be tallest. Compare {nameA} vs{" "}
            {nameB} within a pair of bars, never across pairs.
          </>
        }
      />
    </InfoButton>
  )
}

export function DistributionHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="Rating distribution">
      <Body
        title="Rating distribution"
        def="How each of you spreads your gut scores across buckets (1–40, 41–60, 61–75, 76–85, 86–100). It shows scoring habits rather than agreement."
        reading={
          <>
            If {nameA} piles up in the top bucket and {nameB} sits in the middle, you can still correlate strongly while
            looking at very different numbers.
          </>
        }
      />
    </InfoButton>
  )
}

export function PredictionHelp({
  nameA,
  nameB,
  slope,
  r2,
  n,
}: {
  nameA: string
  nameB: string
  slope: number | null
  r2: number | null
  n: number
}) {
  return (
    <InfoButton label="Prediction">
      <Body
        title="If I rated it X, what do they give it?"
        def={
          <>
            Titles you rated are grouped into buckets; the line shows what {nameB} averaged in each. The dashed grey line
            is perfect agreement. The blue line is a least-squares fit across all shared titles.
          </>
        }
        reading={
          slope === null ? (
            "Not enough shared titles yet to fit a line."
          ) : (
            <>
              Each +10 from {nameA} predicts +{Math.round(slope * 10)} from {nameB} (R² {fmt(r2)}), fitted across{" "}
              {plural(n, "shared title")}. R² near 1 means the prediction is reliable; near 0 means knowing one score
              tells you nothing about the other.
            </>
          )
        }
      />
    </InfoButton>
  )
}

export function GenreHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="Where your tastes split, by genre">
      <Body
        title="Where your tastes split, by genre"
        def="Average signed gut gap per genre — right of zero means the first person is the bigger fan of that genre, left means the second is. It isolates taste from overall scoring habits."
        reading={
          <>
            Bars are the genres you disagree about most, but only from genres with at least 2 shared titles. Direction
            shows who is higher ({nameA} vs {nameB}); length shows how much.
          </>
        }
      />
    </InfoButton>
  )
}

/* --------------------------------------------------------------- extremes */

export function AgreementsHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="Biggest Agreements">
      <Body
        title="Biggest Agreements"
        def="The shared titles where your gut ratings are closest together — the smallest absolute difference, whichever direction it goes."
        reading={
          <>
            Δ shows {nameA} minus {nameB}, so a positive number means {nameA} was higher even though you agreed.
          </>
        }
      />
    </InfoButton>
  )
}

export function FightsHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="Biggest Fights">
      <Body
        title="Biggest Fights"
        def="The shared titles with the widest gap between your gut ratings — the ones you'd argue about first."
        reading={
          <>
            Δ is {nameA} minus {nameB}. Anything past 20 points also counts as a hot take in the KPI row above.
          </>
        }
      />
    </InfoButton>
  )
}

export function TopTenHelp({ count, nameA, nameB }: { count: number; nameA: string; nameB: string }) {
  return (
    <InfoButton label="Top-10 Overlap">
      <Body
        title="Top-10 Overlap"
        def="Titles that appear in both of your personal top 10s by gut rating."
        reading={
          <>
            {count} of 10 shared. Listed titles are in one person&apos;s top 10 but ranked low by {nameA} or {nameB}.
          </>
        }
      />
    </InfoButton>
  )
}

/* -------------------------------------------------------- season agreement */

export function SeasonSectionHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="Season-by-Season Agreement">
      <Body
        title="Season-by-Season Agreement"
        def="The same agreement analysis as above, but on per-season 1–10 ratings from shows you both watched — pairing each show's seasons one at a time instead of whole series."
        reading={
          <>
            Useful when {nameA} and {nameB} agree on a show overall but split on which season was better. DNFs count
            too: quitting the same season is a different kind of agreement than rating it.
          </>
        }
      />
    </InfoButton>
  )
}

export function SeasonNHelp({ n }: { n: number }) {
  return (
    <InfoButton label="Shared season ratings">
      <Body
        title="Shared season ratings"
        def="Number of individual (show, season) pairs where both people gave a rating. Severance S1 and Severance S2 count as two."
        reading={
          <>
            {plural(n, "season")} counted. Correlation needs at least 3 pairs to be meaningful — below that it shows as
            —. TV titles only.
          </>
        }
      />
    </InfoButton>
  )
}

export function SeasonCorrHelp({
  pearson,
  label,
  n,
}: {
  pearson: number | null
  label: string
  n: number
}) {
  return (
    <InfoButton label="Season correlation">
      <Body
        title="Season correlation"
        def="Pearson correlation across those individual seasons — do the seasons one of you rated higher also get rated higher by the other? Separate from the show-level gut correlation."
        reading={
          pearson === null ? (
            "Not enough shared seasons rated by both of you yet — at least 3 are needed."
          ) : (
            <>
              <span className="font-medium">{fmt(pearson)}</span> — {label}, across {plural(n, "shared season")}.
            </>
          )
        }
      />
    </InfoButton>
  )
}

export function SeasonGapHelp({ mad, nameA, nameB }: { mad: number | null; nameA: string; nameB: string }) {
  return (
    <InfoButton label="Avg season gap">
      <Body
        title="Avg season gap"
        def="Mean absolute difference between your season ratings — but on the 1–10 scale, not the 1–100 gut scale. A 1.0 gap here is a whole point of disagreement."
        reading={
          mad === null
            ? "Not enough shared seasons rated by both of you yet."
            : `${nameA} and ${nameB} sit ${fmt(mad, 1)} points apart per season on average.`
        }
      />
    </InfoButton>
  )
}

export function DnfHelp({
  both,
  totalA,
  totalB,
}: {
  both: number
  totalA: number
  totalB: number
}) {
  return (
    <InfoButton label="DNFs you both quit">
      <Body
        title="DNFs you both quit"
        def="Seasons marked did-not-finish. Quitting the same season is agreement too — often stronger than a shared score."
        reading={
          <>
            {both} seasons quit by both, out of {totalA} + {totalB} total DNFs between you.
          </>
        }
      />
    </InfoButton>
  )
}

export function SeasonByShowHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="Where you disagree, by show">
      <Body
        title="Where you disagree, by show"
        def="Average signed gap per season, aggregated by show. Bars right of zero mean the first person rates the seasons higher; left means the second does."
        reading={
          <>
            Only shows with at least one season rated by both {nameA} and {nameB} appear, limited to the 12 most-rated
            shows. Longer bars mean a consistent split across that show&apos;s seasons.
          </>
        }
      />
    </InfoButton>
  )
}

export function DnfOverlapHelp({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <InfoButton label="DNF overlap">
      <Body
        title="DNF overlap"
        def="How your did-not-finish seasons line up — quit the same one, or quit different ones."
        reading={
          <>
            One bar is shared quits, the other two are one-sided ({nameA} only vs {nameB} only). Percentages are of all
            DNFs between you.
          </>
        }
      />
    </InfoButton>
  )
}
