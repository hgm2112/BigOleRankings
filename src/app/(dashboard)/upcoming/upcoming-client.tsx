"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PosterLightbox } from "@/components/poster-lightbox"
import { formatDate } from "@/lib/format-date"
import { CalendarDays, Tv, Loader2, AlertCircle } from "lucide-react"
import type { UpcomingShow } from "@/lib/upcoming-releases"

interface RefreshFailure {
  mediaId: string
  title?: string | null
  error?: string
}

interface RefreshResponse {
  total: number
  updated: number
  failed: number
  failures: RefreshFailure[]
  shows: UpcomingShow[]
}

function posterUrl(path: string | null) {
  return path ? `https://image.tmdb.org/t/p/w185${path}` : null
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

function isRecentRelease(dateStr: string | null | undefined, today: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const diffDays = -daysUntil(dateStr, today)
  return diffDays >= 0 && diffDays <= 30
}

function countdownLabel(dateStr: string, todayIso: string): string {
  const diff = daysUntil(dateStr, todayIso)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Tomorrow"
  return `in ${diff} days`
}

function recencyLabel(dateStr: string, todayIso: string): string {
  const diff = -daysUntil(dateStr, todayIso)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  return `${diff} days ago`
}

function ShowCard({ show, section }: { show: UpcomingShow; section: "new" | "upcoming" | "awaiting" }) {
  const url = posterUrl(show.posterPath)
  const isNew = section === "new"
  const hasUpcomingDate = !!show.upcomingReleaseDate
  const today = todayIsoDateLocal()
  const countdownDays = hasUpcomingDate ? daysUntil(show.upcomingReleaseDate!, today) : null
  const countdownSoon = countdownDays != null && countdownDays <= 14
  const recencyDays = isNew && show.recentReleaseDate ? -daysUntil(show.recentReleaseDate, today) : null
  const recencyRecent = recencyDays != null && recencyDays <= 7
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex gap-3">
          {url ? (
            <PosterLightbox posterPath={show.posterPath} alt={show.title} className="block rounded overflow-hidden flex-shrink-0">
              <div className="relative w-20 h-[120px] bg-muted">
                <Image src={url} alt={show.title} fill sizes="80px" className="object-cover" />
              </div>
            </PosterLightbox>
          ) : (
            <div className="w-20 h-[120px] rounded bg-muted flex items-center justify-center flex-shrink-0">
              <Tv className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div>
              <p className="font-semibold leading-tight line-clamp-2">{show.title}</p>
            </div>
            <div className="text-sm space-y-1">
              {isNew ? (
                <>
                  {show.recentReleaseSeasonNumber != null && (
                    <p className="text-foreground/70">Season {show.recentReleaseSeasonNumber}</p>
                  )}
                  <p className="font-semibold text-foreground">
                    {show.recentReleaseDate ? formatDate(show.recentReleaseDate) : "—"}
                  </p>
                  {show.recentReleaseDate && (
                    <p className={`text-sm font-medium ${recencyRecent ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground"}`}>
                      {recencyLabel(show.recentReleaseDate, today)}
                    </p>
                  )}
                </>
              ) : section === "upcoming" && hasUpcomingDate ? (
                <>
                  {show.upcomingSeasonNumber != null && (
                    <p className="text-foreground/70">Season {show.upcomingSeasonNumber}</p>
                  )}
                  <p className="font-semibold text-foreground">
                    {formatDate(show.upcomingReleaseDate!)}
                  </p>
                  <p className={`text-sm font-medium ${countdownSoon ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground"}`}>
                    {countdownLabel(show.upcomingReleaseDate!, today)}
                  </p>
                </>
              ) : (
                <>
                  {show.expectedSeasonNumber != null ? (
                    <p className="text-foreground/70">Season {show.expectedSeasonNumber} expected</p>
                  ) : show.upcomingSeasonNumber != null ? (
                    <p className="text-foreground/70">Season {show.upcomingSeasonNumber}</p>
                  ) : null}
                  {show.status === "In Production" ? (
                    <p className="text-sm font-medium text-teal-600 dark:text-teal-400">In Production</p>
                  ) : (
                    <p className="text-muted-foreground/60">Release date not announced</p>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function UpcomingReleasesClient({ initialShows }: { initialShows: UpcomingShow[] }) {
  const [shows, setShows] = useState<UpcomingShow[]>(initialShows)
  const [updating, setUpdating] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [failures, setFailures] = useState<RefreshFailure[]>([])

  const { newReleases, dated, awaiting, overallLastChecked } = useMemo(() => {
    const today = todayIsoDateLocal()
    const newReleases = shows
      .filter((s) => isRecentRelease(s.recentReleaseDate, today))
      .sort((a, b) => {
        if (a.recentReleaseDate! !== b.recentReleaseDate!) {
          return a.recentReleaseDate! > b.recentReleaseDate! ? -1 : 1
        }
        return a.title.localeCompare(b.title)
      })

    const newIds = new Set(newReleases.map((s) => s.mediaId))
    const dated = shows
      .filter((s) => !newIds.has(s.mediaId) && !!s.upcomingReleaseDate)
      .sort((a, b) => {
        if (a.upcomingReleaseDate! !== b.upcomingReleaseDate!) {
          return a.upcomingReleaseDate! < b.upcomingReleaseDate! ? -1 : 1
        }
        return a.title.localeCompare(b.title)
      })
    const awaiting = shows
      .filter((s) => !newIds.has(s.mediaId) && !s.upcomingReleaseDate)
      .sort((a, b) => a.title.localeCompare(b.title))

    let overall: string | null = null
    for (const s of shows) {
      if (!s.lastCheckedAt) continue
      if (!overall || s.lastCheckedAt > overall) overall = s.lastCheckedAt
    }
    return { newReleases, dated, awaiting, overallLastChecked: overall }
  }, [shows])

  const handleUpdate = async () => {
    if (updating) return
    setUpdating(true)
    setSummary(null)
    setFailures([])
    setProgress(`Updating 0 of ${shows.length} shows...`)
    try {
      const res = await fetch("/api/upcoming-releases/refresh", { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as Partial<RefreshResponse> & { error?: string }
      if (!res.ok) {
        throw new Error(data.error || "Failed to update release dates")
      }
      if (Array.isArray(data.shows)) {
        setShows(data.shows as UpcomingShow[])
      }
      const updated = data.updated ?? 0
      const total = data.total ?? shows.length
      const failed = data.failed ?? 0
      setFailures(Array.isArray(data.failures) ? (data.failures as RefreshFailure[]) : [])
      if (failed > 0) {
        setSummary(`Updated ${updated} of ${total} shows. ${failed} ${failed === 1 ? "show" : "shows"} could not be updated.`)
      } else {
        setSummary(`Updated ${updated} of ${total} shows.`)
      }
      setProgress("Update complete.")
    } catch (e: any) {
      setSummary(null)
      setProgress(null)
      setFailures([{ mediaId: "", title: null, error: e?.message || "Update failed" }])
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarDays className="h-6 w-6" />Upcoming Releases</h1>
          <p className="text-muted-foreground">So..... this comes out tomorrow, right?</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="flex flex-col items-center gap-1 w-full sm:w-auto">
            <Button onClick={handleUpdate} disabled={updating || shows.length === 0}>
              {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarDays className="h-4 w-4 mr-2" />}
              {updating ? "Updating..." : "Update Release Dates"}
            </Button>
            {overallLastChecked && (
              <p className="text-xs text-muted-foreground text-center">Last checked (latest): {formatDate(overallLastChecked)}</p>
            )}
          </div>
          {(progress || summary) && (
            <div className="text-sm text-muted-foreground text-left sm:text-right">
              {progress && <p>{progress}</p>}
              {summary && <p className="font-medium text-foreground">{summary}</p>}
            </div>
          )}
        </div>
      </div>

      {failures.length > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Some shows could not be updated</p>
                <ul className="mt-1 text-muted-foreground list-disc list-inside">
                  {failures.map((f, i) => (
                    <li key={`${f.mediaId}-${i}`}>
                      {f.title || "A show"}{f.error ? ` — ${f.error}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs">Previously saved information was kept for failed shows.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {shows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <p className="font-medium">No upcoming shows yet</p>
            <p className="text-sm text-muted-foreground">
              TV shows you&apos;ve rated that are returning or in production will appear here with their upcoming and recently released season premieres.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {newReleases.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">New Releases</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {newReleases.map((show) => <ShowCard key={show.mediaId} show={show} section="new" />)}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Upcoming release dates</h2>
            {dated.length === 0 ? (
              <p className="text-sm text-muted-foreground">No confirmed upcoming release dates yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dated.map((show) => <ShowCard key={show.mediaId} show={show} section="upcoming" />)}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Awaiting Release Date</h2>
            {awaiting.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shows awaiting a release date.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {awaiting.map((show) => <ShowCard key={show.mediaId} show={show} section="awaiting" />)}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
