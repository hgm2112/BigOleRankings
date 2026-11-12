"use client"

import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { MediaTypeBadge } from "@/components/media-type-badge"
import { PosterLightbox } from "@/components/poster-lightbox"
import { Film, Tv, Play, PlayCircle, Star } from "lucide-react"
import { formatDate } from "@/lib/format-date"
import { formatDuration, type WatchPeriodWithMedia } from "@/lib/watching"

function posterUrl(path: string | null, size = "w185") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null
}

function statusLabel(status: WatchPeriodWithMedia["status"]) {
  switch (status) {
    case "currently_watching": return "Currently Watching"
    case "finished": return "Finished"
    case "dnf": return "DNF"
    case "stopped": return "Paused"
  }
}

function StatusPill({ status }: { status: WatchPeriodWithMedia["status"] }) {
  const cls =
    status === "currently_watching" ? "bg-emerald-600 text-emerald-50 ring-1 ring-inset ring-emerald-300/30" :
    status === "finished" ? "bg-[#8a5b00] text-[#ffc94d] ring-1 ring-inset ring-[#ffd27a]/40" :
    status === "dnf" ? "bg-[#6b0000] text-[#ff6b6b] ring-1 ring-inset ring-[#ff8a8a]/35" :
    "bg-[#7a2e00] text-[#ff9a3d] ring-1 ring-inset ring-[#ffb066]/40"
  return <span className={`inline-flex items-center justify-center min-w-[92px] text-[12px] px-2.5 py-0.5 rounded-full font-medium ${cls}`}>{statusLabel(status)}</span>
}

function historyDateLine(startedAt: string, endedAt: string | null) {
  if (!endedAt) return formatDate(startedAt)
  const start = new Date(`${startedAt}T00:00:00`)
  const end = new Date(`${endedAt}T00:00:00`)
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start.getTime() === end.getTime()) {
    return formatDate(startedAt)
  }
  return `${formatDate(startedAt)} to ${formatDate(endedAt)}`
}

function historyDurationLine(startedAt: string, endedAt: string | null) {
  if (endedAt) {
    const start = new Date(`${startedAt}T00:00:00`)
    const end = new Date(`${endedAt}T00:00:00`)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start.getTime() === end.getTime()) {
      return "same day"
    }
  }
  return formatDuration(startedAt, endedAt)
}

function formatHistoryDate(dateStr: string) {
  return formatDate(dateStr)
}

export function UserWatchingView({
  profile,
  active,
  history,
  seasonRatings = {},
}: {
  profile: { username: string | null; display_name: string | null }
  active: WatchPeriodWithMedia[]
  history: WatchPeriodWithMedia[]
  seasonRatings?: Record<string, { rating: number | null; dnf: boolean }>
}) {
  const displayName = profile.display_name || profile.username || "User"

  const getSeasonRating = (p: WatchPeriodWithMedia) => {
    if (p.media_type !== "tv" || p.season_number == null) return null
    const sr = seasonRatings[`${p.media_id}:${p.season_number}`]
    if (!sr || sr.rating == null) return null
    return sr.rating
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PlayCircle className="h-6 w-6" />
          {displayName}&apos;s Watching
        </h1>
        <p className="text-muted-foreground">
          What {displayName} is currently watching and their watch history.
          {profile.username && (
            <>
              {" "}
              <Link href={`/users/${profile.username}`} className="underline hover:text-foreground">
                View profile
              </Link>
            </>
          )}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Currently Watching</h2>
        {active.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Not currently watching anything.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((p) => {
              const url = posterUrl(p.media.poster_path)
              const line3 = p.media.media_type === "tv"
                ? `${p.media.year ? `${p.media.year} - ` : ""}Season ${p.season_number}`
                : (p.media.year ? `${p.media.year}` : "")
              const rating = getSeasonRating(p)
              return (
                <Card key={p.id}>
                  <CardContent className="pt-4">
                    <div className="flex gap-3">
                      {url ? (
                        <PosterLightbox posterPath={p.media.poster_path} alt={p.media.title} className="block rounded overflow-hidden flex-shrink-0">
                          <div className="relative w-20 h-30 bg-muted">
                            <Image src={url} alt={p.media.title} fill sizes="80px" className="object-cover" />
                          </div>
                        </PosterLightbox>
                      ) : (
                        <div className="w-20 h-30 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          {p.media.media_type === "tv" ? <Tv className="h-5 w-5" /> : <Film className="h-5 w-5" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-semibold truncate leading-tight">{p.media.title}</p>
                        <div><MediaTypeBadge type={p.media.media_type} /></div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-muted-foreground truncate">{line3 || "—"}</p>
                          <StatusPill status={p.status} />
                          {rating != null && (
                            <span className="inline-flex items-center gap-1 text-xs text-foreground">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              <span>{rating}/10</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Started {formatDate(p.started_at)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">History</h2>
        {history.length === 0 ? (
          <Card><CardContent className="py-3 text-center text-muted-foreground text-sm">No watch history yet.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {history.map((p) => {
              const url = posterUrl(p.media.poster_path, "w185")
              const seasonLabel = p.media.media_type === "tv" ? `Season ${p.season_number}` : "Movie"
              const rating = getSeasonRating(p)
              const rightColor =
                p.status === "finished" ? "text-[#ffc94d]" :
                p.status === "dnf" ? "text-[#b91c1c]" :
                "text-[#ff9a3d]"
              return (
                <Card key={p.id} className="h-[141px] rounded-[10px] border-2 border-[#3f3a5d]">
                  <CardContent className="p-[10px] h-full">
                    <div className="flex gap-3 h-full">
                      {url ? (
                        <PosterLightbox posterPath={p.media.poster_path} alt={p.media.title} className="block rounded overflow-hidden flex-shrink-0">
                          <div className="relative w-20 h-30 bg-muted">
                            <Image src={url} alt={p.media.title} fill sizes="80px" className="object-cover" />
                          </div>
                        </PosterLightbox>
                      ) : (
                        <div className="w-20 h-30 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          {p.media.media_type === "tv" ? <Tv className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col h-30">
                        <p className="font-semibold text-base leading-tight truncate text-foreground">{p.media.title}</p>
                        <p className="text-[13px] font-semibold text-foreground leading-tight -mt-1">{seasonLabel}</p>
                        <p className="text-[13px] text-[#7f7f7f] mt-2 leading-tight">{historyDateLine(p.started_at, p.ended_at)}</p>
                        <p className="text-[13px] text-[#7f7f7f] leading-tight">{historyDurationLine(p.started_at, p.ended_at)}</p>
                        <div className="flex items-center justify-between gap-2 mt-auto">
                          <StatusPill status={p.status} />
                          {p.status === "stopped" ? (
                            <span className="inline-flex items-center justify-center h-8 w-8 text-[#ff9a3d]" aria-label="Paused">
                              <Play className="h-[18px] w-[18px] fill-current" />
                            </span>
                          ) : rating != null ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Star className={`h-[18px] w-[18px] fill-current ${rightColor}`} />
                              <span className="text-[16px] leading-none font-medium text-foreground">{rating}/10</span>
                            </span>
                          ) : (
                            <span />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
