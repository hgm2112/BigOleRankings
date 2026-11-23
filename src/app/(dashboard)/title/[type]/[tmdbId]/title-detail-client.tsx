"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { MediaTypeBadge } from "@/components/media-type-badge"
import { PosterLightbox } from "@/components/poster-lightbox"
import { ArrowLeft, Bookmark, BookmarkPlus, Eye, Film, Loader2, Minus, PlayCircle, Plus, Repeat, Star, Tv } from "lucide-react"
import { todayLocalDate } from "@/lib/watching"

interface TMDBSeason {
  season_number: number
  name: string
  air_year: number | null
  air_date: string | null
  episode_count: number
}

interface TMDBTitleDetails {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: string
  media_type: "movie" | "tv"
  overview: string
  genres: string[]
  runtime: number | null
  episode_runtime: number | null
  seasons: TMDBSeason[] | null
  status: string | null
  next_air_date: string | null
  network: string | null
}

interface WatchlistState {
  eligible: boolean
  onWatchlist: boolean
  reason: string | null
}

function formatRuntime(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export function TitleDetailClient({
  details,
  mediaId: initialMediaId,
  initialWatchlist,
  hasActiveWatching: initialActiveWatching,
  viewerCount = 0,
  avgGutRating = null,
  avgDetailedRating = null,
  manualRewatchWhole = 0,
  manualRewatchBySeason = {},
}: {
  details: TMDBTitleDetails
  mediaId: string | null
  initialWatchlist: WatchlistState
  hasActiveWatching: boolean
  viewerCount?: number
  avgGutRating?: number | null
  avgDetailedRating?: number | null
  manualRewatchWhole?: number
  manualRewatchBySeason?: Record<number, number>
}) {
  const router = useRouter()
  const [watchlist, setWatchlist] = useState<WatchlistState>(initialWatchlist)
  const [watchlistBusy, setWatchlistBusy] = useState(false)
  const [watchlistMsg, setWatchlistMsg] = useState<string | null>(null)
  const [activeWatching, setActiveWatching] = useState(initialActiveWatching)

  const [watchOpen, setWatchOpen] = useState(false)
  const [watchBusy, setWatchBusy] = useState(false)
  const [watchError, setWatchError] = useState<string | null>(null)
  const [seasonNumber, setSeasonNumber] = useState<string>("")
  const [startDate, setStartDate] = useState(todayLocalDate())
  const [mediaId, setMediaId] = useState<string | null>(initialMediaId)
  const [manualWhole, setManualWhole] = useState(manualRewatchWhole)
  const [manualBySeason, setManualBySeason] = useState<Record<number, number>>(manualRewatchBySeason)
  const [rewatchBusyKey, setRewatchBusyKey] = useState<string | null>(null)

  const adjustManualRewatch = async (sn: number | null, delta: 1 | -1) => {
    const key = sn == null ? "whole" : `season:${sn}`
    if (rewatchBusyKey) return
    setRewatchBusyKey(key)
    try {
      const res = await fetch("/api/rewatches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_id: mediaId ?? undefined,
          tmdb_id: mediaId ? undefined : details.tmdb_id,
          media_type: mediaId ? undefined : details.media_type,
          title: mediaId ? undefined : details.title,
          poster_path: mediaId ? undefined : details.poster_path,
          year: mediaId ? undefined : (details.year ? parseInt(details.year) : null),
          season_number: sn,
          delta,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to update rewatch count")
      const next = typeof data.count === "number" ? data.count : 0
      if (typeof data.media_id === "string") setMediaId(data.media_id)
      if (sn == null) setManualWhole(next)
      else setManualBySeason((prev) => ({ ...prev, [sn]: next }))
    } catch {
      // ignore; user can retry
    } finally {
      setRewatchBusyKey(null)
    }
  }

  const renderRewatchCounter = (sn: number | null, total: number, label = "Rewatched") => {
    const key = sn == null ? "whole" : `season:${sn}`
    const busy = rewatchBusyKey === key
    if (total <= 0) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-muted-foreground"
          onClick={() => adjustManualRewatch(sn, 1)}
          disabled={busy}
          aria-label={`Add ${label.toLowerCase()}`}
          title={`Add ${label.toLowerCase()}`}
        >
          <Repeat className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          <Plus className="h-3 w-3" />
        </Button>
      )
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={label}>
        <Repeat className="h-3.5 w-3.5 mr-0.5" aria-hidden="true" />
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => adjustManualRewatch(sn, -1)} disabled={busy || total <= 0} aria-label={`Decrease ${label.toLowerCase()} count`}>
          <Minus className="h-3 w-3" />
        </Button>
        <span className="tabular-nums w-4 text-center">{total}</span>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => adjustManualRewatch(sn, 1)} disabled={busy} aria-label={`Increase ${label.toLowerCase()} count`}>
          <Plus className="h-3 w-3" />
        </Button>
      </span>
    )
  }

  const seasons = useMemo(
    () => (details.seasons ?? []).filter((s) => s.season_number >= 1),
    [details.seasons]
  )

  const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null

  const rateHref = `/entries/new?${new URLSearchParams({
    tmdb_id: String(details.tmdb_id),
    media_type: details.media_type,
    title: details.title,
    year: details.year || "",
    poster_path: details.poster_path ?? "",
  }).toString()}`

  const addToWatchlist = async () => {
    setWatchlistBusy(true)
    setWatchlistMsg(null)
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdb_id: details.tmdb_id,
          media_type: details.media_type,
          title: details.title,
          poster_path: details.poster_path,
          year: details.year ? parseInt(details.year) : null,
          runtime: details.runtime,
          genres: details.genres,
          status: details.status,
          next_air_date: details.next_air_date,
          network: details.network,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const reason = data.reason as string | undefined
        setWatchlist({
          eligible: false,
          onWatchlist: reason === "already_on_watchlist",
          reason:
            reason === "already_on_watchlist" ? "Already on Watchlist" :
            reason === "currently_watching" ? "Currently watching" :
            reason === "already_watched_or_rated" ? "Already watched or rated" :
            data.error || "Could not add to Watchlist",
        })
        setWatchlistMsg(null)
        return
      }
      setWatchlist({ eligible: false, onWatchlist: true, reason: "Already on Watchlist" })
      setWatchlistMsg("Added to Watchlist")
      router.refresh()
    } catch (e: any) {
      setWatchlistMsg(e?.message || "Failed to add to Watchlist")
    } finally {
      setWatchlistBusy(false)
    }
  }

  const openStartWatching = () => {
    setWatchError(null)
    setStartDate(todayLocalDate())
    if (details.media_type === "tv" && seasons.length > 0) {
      setSeasonNumber(String(seasons[0].season_number))
    } else {
      setSeasonNumber("")
    }
    setWatchOpen(true)
  }

  const startWatching = async () => {
    if (details.media_type === "tv" && !seasonNumber) {
      setWatchError("Select a season to watch")
      return
    }
    setWatchBusy(true)
    setWatchError(null)
    try {
      const res = await fetch("/api/watching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          tmdb_id: details.tmdb_id,
          media_type: details.media_type,
          title: details.title,
          poster_path: details.poster_path,
          year: details.year ? parseInt(details.year) : null,
          runtime: details.runtime,
          genres: details.genres,
          status: details.status,
          next_air_date: details.next_air_date,
          network: details.network,
          seasons: seasons.map((s) => ({
            season_number: s.season_number,
            name: s.name,
            air_year: s.air_year,
            episode_count: s.episode_count,
          })),
          season_number: details.media_type === "tv" ? Number(seasonNumber) : undefined,
          started_at: startDate,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to start watching")
      setWatchOpen(false)
      setActiveWatching(true)
      setWatchlist({ eligible: false, onWatchlist: false, reason: "Currently watching" })
      router.refresh()
    } catch (e: any) {
      setWatchError(e?.message || "Failed to start watching")
    } finally {
      setWatchBusy(false)
    }
  }

  const watchlistLabel = watchlist.onWatchlist
    ? "On Watchlist"
    : watchlist.eligible
      ? "Add to Watchlist"
      : (watchlist.reason || "Not available")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/entries"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              {posterUrl ? (
                <PosterLightbox posterPath={details.poster_path} alt={details.title} className="block rounded overflow-hidden">
                  <div className="relative w-40 h-60 bg-muted">
                    <Image src={posterUrl} alt={details.title} fill sizes="160px" className="object-cover" priority />
                  </div>
                </PosterLightbox>
              ) : (
                <div className="w-40 h-60 rounded bg-muted flex items-center justify-center">
                  {details.media_type === "tv" ? <Tv className="h-8 w-8 text-muted-foreground" /> : <Film className="h-8 w-8 text-muted-foreground" />}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left">
              <div>
                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                  <h1 className="text-2xl font-bold leading-tight">{details.title}</h1>
                  {viewerCount > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-start">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-muted/50 text-muted-foreground whitespace-nowrap"
                        title={`${viewerCount} ${viewerCount === 1 ? "user" : "users"} rated this`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="tabular-nums">{viewerCount}</span>
                      </span>
                      {avgGutRating != null && (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap tabular-nums bg-[#064e4e] text-[#5eead4] ring-1 ring-inset ring-[#5eead4]/35">
                          Gut {avgGutRating}
                        </span>
                      )}
                      {avgDetailedRating != null && (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap tabular-nums bg-[#3b0764] text-[#d8b4fe] ring-1 ring-inset ring-[#d8b4fe]/35">
                          Det {avgDetailedRating}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start mt-1 text-sm text-muted-foreground">
                  <MediaTypeBadge type={details.media_type} />
                  {details.year && <span>{details.year}</span>}
                  {details.media_type === "movie" && formatRuntime(details.runtime) && <span>• {formatRuntime(details.runtime)}</span>}
                  {details.media_type === "tv" && formatRuntime(details.episode_runtime) && <span>• {formatRuntime(details.episode_runtime)}/ep</span>}
                  {details.media_type === "tv" && details.status && <span>• {details.status}</span>}
                  {details.media_type === "tv" && details.network && <span>• {details.network}</span>}
                </div>
              </div>

              {details.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  {details.genres.map((g) => (
                    <span key={g} className="inline-flex items-center rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-normal text-secondary-foreground">{g}</span>
                  ))}
                </div>
              )}

              {details.overview && (
                <p className="text-sm text-muted-foreground leading-relaxed">{details.overview}</p>
              )}

              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex gap-2 w-full justify-center sm:w-auto sm:contents">
                  <Button
                    variant={watchlist.onWatchlist ? "secondary" : "outline"}
                    onClick={addToWatchlist}
                    disabled={watchlistBusy || !watchlist.eligible}
                    className="flex-1 sm:flex-initial"
                  >
                    {watchlistBusy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : watchlist.onWatchlist ? <Bookmark className="h-4 w-4 mr-1.5" /> : <BookmarkPlus className="h-4 w-4 mr-1.5" />}
                    {watchlistLabel}
                  </Button>

                  {activeWatching ? (
                    <Button variant="secondary" asChild className="flex-1 sm:flex-initial">
                      <Link href="/watching"><PlayCircle className="h-4 w-4 mr-1.5" />Currently Watching</Link>
                    </Button>
                  ) : (
                    <Button onClick={openStartWatching} disabled={details.media_type === "tv" && seasons.length === 0} className="flex-1 sm:flex-initial">
                      <PlayCircle className="h-4 w-4 mr-1.5" />Start Watching
                    </Button>
                  )}
                </div>

                <div className="flex justify-center w-full sm:w-auto sm:contents">
                  <Button variant="ghost" asChild>
                    <Link href={rateHref}><Star className="h-4 w-4 mr-1.5" />Rate this</Link>
                  </Button>
                </div>
              </div>

              {watchlistMsg && <p className="text-sm text-green-600">{watchlistMsg}</p>}
              {!watchlist.eligible && !watchlist.onWatchlist && watchlist.reason && (
                <p className="text-xs text-muted-foreground">{watchlist.reason}</p>
              )}
              {details.media_type === "movie" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center sm:justify-start">
                  <span>Rewatched:</span>
                  {renderRewatchCounter(null, manualWhole, "Rewatches")}
                </div>
              )}
              {details.media_type === "tv" && seasons.length === 0 && (
                <p className="text-xs text-muted-foreground">No released season data available yet, so watching can&apos;t be started for this show right now.</p>
              )}
            </div>
          </div>

          {details.media_type === "tv" && seasons.length > 0 && (
            <>
              <Separator className="my-5" />
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h2 className="font-semibold">Seasons</h2>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <span>Show rewatches:</span>
                    {renderRewatchCounter(null, manualWhole, "Show rewatches")}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {seasons.map((s) => {
                    const seasonRewatchCount = manualBySeason[s.season_number] ?? 0
                    return (
                      <div key={s.season_number} className="text-sm text-muted-foreground rounded-md border px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">{s.name || `Season ${s.season_number}`}</span>
                          <span className="text-xs ml-2 whitespace-nowrap">
                            {s.air_year ? `${s.air_year} · ` : ""}{s.episode_count} ep{s.episode_count === 1 ? "" : "s"}
                          </span>
                        </div>
                        {renderRewatchCounter(s.season_number, seasonRewatchCount, `Season ${s.season_number} rewatches`)}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={watchOpen} onOpenChange={(o) => { setWatchOpen(o); if (!o) setWatchError(null) }}>
        <DialogContent className="w-[calc(100%-2rem)] sm:w-fit sm:min-w-[22rem] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start Watching</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              {posterUrl ? (
                <Image src={`https://image.tmdb.org/t/p/w185${details.poster_path}`} alt={details.title} width={48} height={72} className="rounded object-cover" />
              ) : (
                <div className="w-12 h-[72px] rounded bg-muted flex items-center justify-center">
                  {details.media_type === "tv" ? <Tv className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                </div>
              )}
              <div>
                <p className="font-semibold leading-tight">{details.title}</p>
                <p className="text-sm text-muted-foreground">{details.year} · {details.media_type === "tv" ? "TV Show" : "Movie"}</p>
              </div>
            </div>

            {details.media_type === "tv" && (
              <div className="space-y-1">
                <Label>Season</Label>
                {seasons.length > 0 ? (
                  <Select value={seasonNumber} onValueChange={setSeasonNumber}>
                    <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                    <SelectContent>
                      {seasons.map((s) => (
                        <SelectItem key={s.season_number} value={String(s.season_number)}>
                          {s.name || `Season ${s.season_number}`}{s.air_year ? ` (${s.air_year})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No released season data available for this show yet.</p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="start-date">Date started</Label>
              <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            {watchError && <p className="text-sm text-destructive">{watchError}</p>}

            <div className="flex justify-center">
              <Button onClick={startWatching} disabled={watchBusy || (details.media_type === "tv" && (!seasons.length || !seasonNumber))}>
                {watchBusy ? "Starting..." : "Start Watching"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
