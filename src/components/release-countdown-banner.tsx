"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight, CheckCircle2, Loader2, Tv } from "lucide-react"
import { PosterLightbox } from "@/components/poster-lightbox"
import { formatDate } from "@/lib/format-date"
import { cn } from "@/lib/utils"

export interface CountdownRelease {
  mediaId: string
  tmdbId: number
  title: string
  posterPath: string | null
  year: number | null
  upcomingSeasonNumber: number | null
  upcomingReleaseDate: string
  status?: string | null
}

function todayIsoDateLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function daysUntil(dateStr: string, todayIso: string): number {
  const [y1, m1, d1] = dateStr.split("-").map(Number)
  const [y2, m2, d2] = todayIso.split("-").map(Number)
  const target = new Date(y1, m1 - 1, d1)
  const today = new Date(y2, m2 - 1, d2)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function posterUrl(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w185${path}` : null
}

export function ReleaseCountdownBanner({ release }: { release: CountdownRelease }) {
  const [startState, setStartState] = useState<"idle" | "loading" | "watching" | "error">("idle")
  const [startError, setStartError] = useState<string | null>(null)

  const today = todayIsoDateLocal()
  const diff = daysUntil(release.upcomingReleaseDate, today)
  if (diff < 0 || diff > 7) return null

  const stage = diff === 0 ? 3 : diff <= 3 ? 2 : 1
  const premiereLabel = formatDate(release.upcomingReleaseDate)
  const headline = diff === 0 ? "Premieres today" : diff === 1 ? "Tomorrow" : `in ${diff} days`
  const supporting =
    stage === 3
      ? "Clear your schedule."
      : stage === 2
        ? `Is it tomorrow yet? Almost. ${premiereLabel}`
        : `Premieres ${premiereLabel}`

  const eyebrow = release.upcomingSeasonNumber != null
    ? `${release.title} · S${release.upcomingSeasonNumber}`
    : release.title

  const url = posterUrl(release.posterPath)

  const handleStartWatching = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (startState === "loading" || startState === "watching") return
    if (release.upcomingSeasonNumber == null) {
      setStartError("Season not set")
      setStartState("error")
      return
    }
    setStartState("loading")
    setStartError(null)
    try {
      const res = await fetch("/api/watching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          media_type: "tv",
          tmdb_id: release.tmdbId,
          title: release.title,
          poster_path: release.posterPath,
          year: release.year,
          season_number: release.upcomingSeasonNumber,
          ...(release.status ? { status: release.status } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409) {
          setStartState("watching")
          return
        }
        throw new Error(data?.error || "Failed to start watching")
      }
      setStartState("watching")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start"
      setStartError(message)
      setStartState("error")
    }
  }

  const cardClass = cn(
    "relative flex items-center gap-3 sm:gap-2.5 rounded-[16px] border p-3 sm:px-3 sm:py-1.5 w-full sm:w-auto sm:min-w-[300px] sm:max-w-[420px] sm:h-full overflow-hidden",
    "bg-gradient-to-br from-card via-card to-muted/40",
    stage === 1 && "border-primary/30 shadow-[0_0_24px_-8px_var(--color-primary)]",
    stage === 2 && "border-primary/50 shadow-[0_0_32px_-6px_var(--color-primary)]",
    stage === 3 && "border-primary/70 shadow-[0_0_40px_-4px_var(--color-primary)]"
  )

  const content = (
    <>
      {stage === 3 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full animate-countdown-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
      )}
      {url ? (
        <PosterLightbox
          posterPath={release.posterPath}
          alt={release.title}
          className="block rounded-md overflow-hidden flex-shrink-0"
        >
          <div className="relative w-14 h-20 sm:w-[38px] sm:h-[54px] bg-muted">
            <Image src={url} alt={release.title} fill sizes="(min-width: 640px) 38px, 56px" className="object-cover" />
          </div>
        </PosterLightbox>
      ) : (
        <div className="w-14 h-20 sm:w-[38px] sm:h-[54px] rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <Tv className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0 sm:py-0.5">
        <div className="flex items-center gap-2 sm:gap-1.5 mb-0.5 sm:mb-0">
          {(stage === 2 || stage === 3) && (
            <span className="relative flex h-2.5 w-2.5 sm:h-2 sm:w-2" aria-hidden>
              <span className={cn("absolute inline-flex h-full w-full rounded-full bg-primary opacity-60", stage === 2 ? "animate-countdown-pulse" : "animate-countdown-pulse-fast")} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-2 sm:w-2 bg-primary" />
            </span>
          )}
          <p className="text-[10px] sm:text-[10px] font-medium uppercase tracking-[0.14em] text-primary/90 truncate">
            {eyebrow}
          </p>
        </div>
        <p className="text-2xl sm:text-lg font-bold leading-tight sm:leading-none text-foreground">{headline}</p>
        <p className="text-xs sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-0 sm:leading-tight sm:truncate">{supporting}</p>
      </div>
      <div className="flex-shrink-0 pl-1 sm:pl-0.5 self-center">
        {stage < 3 ? (
          <Link
            href="/upcoming"
            aria-label={`View upcoming releases for ${release.title}`}
            className="inline-flex items-center justify-center rounded-md p-1.5 -m-1.5 text-muted-foreground hover:text-foreground hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden />
          </Link>
        ) : startState === "watching" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-3 py-1.5 sm:px-2.5 sm:py-1 text-sm sm:text-xs font-medium">
            <CheckCircle2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
            Watching
          </span>
        ) : (
          <button
            type="button"
            onClick={handleStartWatching}
            disabled={startState === "loading" || release.upcomingSeasonNumber == null}
            className="inline-flex items-center justify-center rounded-md bg-primary px-3.5 py-2 sm:px-2.5 sm:py-1 text-sm sm:text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
          >
            {startState === "loading" ? <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin" aria-hidden /> : "Start watching"}
          </button>
        )}
      </div>
      {stage === 3 && startState === "error" && startError && (
        <span className="sr-only">{startError}</span>
      )}
    </>
  )

  return (
    <div
      className={cardClass}
      role="group"
      aria-label={`${release.title} ${headline}. ${supporting}`}
    >
      {content}
      {stage === 3 && startState === "error" && startError && (
        <p className="absolute bottom-1 right-3 text-[10px] text-destructive">{startError}</p>
      )}
    </div>
  )
}
