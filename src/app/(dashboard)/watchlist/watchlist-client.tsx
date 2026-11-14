"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { TMDSearch, type TMDBResult } from "@/components/tmdb-search"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PosterLightbox } from "@/components/poster-lightbox"
import { MediaTypeBadge } from "@/components/media-type-badge"
import { Film, Tv, Bookmark, Play, Trash2, BookmarkCheck } from "lucide-react"
import { todayLocalDate, type WatchPeriodWithMedia } from "@/lib/watching"

interface WatchlistItem {
  id: string
  media_id: string
  created_at: string
  tmdb_id: number
  media_type: "movie" | "tv"
  title: string
  poster_path: string | null
  year: number | null
  season_count: number | null
}

interface TMDBDetails {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: number | null
  media_type: string
  runtime: number | null
  genres?: string[]
  status?: string | null
  next_air_date?: string | null
  network?: string | null
  seasons?: { season_number: number; name: string; air_year: number | null; episode_count: number }[]
}

function posterUrl(path: string | null, size = "w185") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null
}

export function WatchlistClient({ initialItems }: { initialItems: WatchlistItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState<WatchlistItem[]>(initialItems)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const [startTarget, setStartTarget] = useState<WatchlistItem | null>(null)
  const [details, setDetails] = useState<TMDBDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [seasonNumber, setSeasonNumber] = useState("")
  const [startDate, setStartDate] = useState(todayLocalDate())
  const [startError, setStartError] = useState<string | null>(null)

  const itemsByTmdbKey = useMemo(() => {
    const m = new Set<string>()
    for (const i of items) m.add(`${i.media_type}:${i.tmdb_id}`)
    return m
  }, [items])

  const addToWatchlist = async (item: TMDBResult) => {
    setFeedback(null)
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdb_id: item.tmdb_id,
        media_type: item.media_type,
        title: item.title,
        poster_path: item.poster_path,
        year: item.year ? Number(item.year) : null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const reason = data.reason
      const text =
        reason === "currently_watching" ? "Currently watching" :
        reason === "already_watched_or_rated" ? "Already watched or rated" :
        reason === "already_on_watchlist" ? "Already on Watchlist" :
        data.error || "Failed to add to watchlist"
      setFeedback({ type: "error", text })
      throw new Error(text)
    }
    if (data.item) {
      setItems((prev) => [data.item as WatchlistItem, ...prev.filter((p) => p.media_id !== data.item.media_id)])
    }
    setFeedback({ type: "success", text: "Added to Watchlist" })
  }

  const removeFromWatchlist = async (mediaId: string) => {
    const prev = items
    setItems((cur) => cur.filter((i) => i.media_id !== mediaId))
    setFeedback(null)
    try {
      const res = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_id: mediaId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to remove")
      setFeedback({ type: "success", text: "Removed from Watchlist" })
    } catch (e: any) {
      setItems(prev)
      setFeedback({ type: "error", text: e?.message || "Failed to remove from Watchlist" })
    }
  }

  const openStart = async (item: WatchlistItem) => {
    setStartTarget(item)
    setDetails(null)
    setSeasonNumber("")
    setStartDate(todayLocalDate())
    setStartError(null)
    setDetailsLoading(true)
    try {
      const res = await fetch(`/api/tmdb/details?id=${item.tmdb_id}&type=${item.media_type}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load details")
      setDetails(data)
      if (data.media_type === "tv" && Array.isArray(data.seasons) && data.seasons.length > 0) {
        setSeasonNumber(String(data.seasons[0].season_number))
      }
    } catch (e: any) {
      setStartError(e?.message || "Failed to load details")
    } finally {
      setDetailsLoading(false)
    }
  }

  const closeStart = () => {
    setStartTarget(null)
    setDetails(null)
    setSeasonNumber("")
    setStartError(null)
  }

  const doStart = async () => {
    if (!startTarget || !details) return
    if (details.media_type === "tv" && !seasonNumber) {
      setStartError("Select a season to watch")
      return
    }
    const key = `start:${startTarget.media_id}`
    setBusyKey(key)
    setStartError(null)
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
          year: details.year,
          runtime: details.runtime,
          genres: details.genres,
          status: details.status,
          next_air_date: details.next_air_date,
          network: details.network,
          seasons: details.seasons,
          season_number: details.media_type === "tv" ? Number(seasonNumber) : undefined,
          started_at: startDate,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to start watching")

      // Success: remove from watchlist UI (server/trigger also removes)
      setItems((prev) => prev.filter((i) => i.media_id !== startTarget.media_id))
      closeStart()
      router.push("/watching")
      router.refresh()
    } catch (e: any) {
      setStartError(e?.message || "Failed to start watching")
      // Preserve watchlist entry on failure
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bookmark className="h-6 w-6" />Watchlist</h1>
        <p className="text-muted-foreground">Movies and shows you want to watch later.</p>
      </div>

      <section className="space-y-3">
        <TMDSearch selectionMode="watchlist" onSelect={() => {}} onAddToWatchlist={addToWatchlist} />
        {feedback && (
          <p className={`text-sm ${feedback.type === "error" ? "text-destructive" : "text-green-600"}`}>
            {feedback.text}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Saved titles</h2>
        {items.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center space-y-2">
              <p className="font-medium">Your Watchlist is empty</p>
              <p className="text-sm text-muted-foreground">
                Save movies and shows you want to watch later. Search above to find a movie or TV show to add.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const url = posterUrl(item.poster_path)
              const removing = busyKey === `remove:${item.media_id}`
              return (
                <Card key={item.media_id}>
                  <CardContent className="pt-4">
                    <div className="flex gap-3">
                      {url ? (
                        <PosterLightbox posterPath={item.poster_path} alt={item.title} className="block rounded overflow-hidden flex-shrink-0">
                          <div className="relative w-20 h-30 bg-muted">
                            <Image src={url} alt={item.title} fill sizes="80px" className="object-cover" />
                          </div>
                        </PosterLightbox>
                      ) : (
                        <div className="w-20 h-30 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          {item.media_type === "tv" ? <Tv className="h-5 w-5 text-muted-foreground" /> : <Film className="h-5 w-5 text-muted-foreground" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-semibold truncate leading-tight">{item.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <MediaTypeBadge type={item.media_type} />
                          {item.media_type === "tv" && (item.season_count ?? 0) > 0 && (
                            <span>{item.season_count} season{item.season_count === 1 ? "" : "s"}</span>
                          )}
                          {item.year ? <span>{item.year}</span> : null}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button size="sm" onClick={() => openStart(item)} disabled={!!busyKey}>
                            <Play className="h-4 w-4 mr-1" />Start watching
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setBusyKey(`remove:${item.media_id}`)
                              removeFromWatchlist(item.media_id).finally(() => setBusyKey(null))
                            }}
                            disabled={!!busyKey}
                            aria-label="Remove from Watchlist"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />{removing ? "Removing..." : "Remove"}
                          </Button>
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

      <Dialog open={!!startTarget} onOpenChange={(o) => { if (!o) closeStart() }}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start watching</DialogTitle>
          </DialogHeader>
          {!startTarget ? null : detailsLoading ? (
            <p className="text-sm text-muted-foreground">Loading details...</p>
          ) : details ? (
            <div className="space-y-4">
              <div>
                <p className="font-semibold">{details.title}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap mt-0.5">
                  <MediaTypeBadge type={details.media_type} />
                  {details.media_type === "tv" && (() => {
                    const count = (details.seasons ?? []).filter((s) => typeof s?.season_number === "number" && s.season_number >= 1).length
                    return count > 0 ? <span>{count} season{count === 1 ? "" : "s"}</span> : null
                  })()}
                  {details.year ? <span>{details.year}</span> : null}
                </div>
              </div>
              {details.media_type === "tv" && (
                <div className="space-y-1">
                  <Label>Season</Label>
                  {details.seasons && details.seasons.length > 0 ? (
                    <Select value={seasonNumber} onValueChange={setSeasonNumber}>
                      <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                      <SelectContent>
                        {details.seasons.map((s) => (
                          <SelectItem key={s.season_number} value={String(s.season_number)}>
                            {s.name || `Season ${s.season_number}`} {s.air_year ? `(${s.air_year})` : ""}
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
                <Label htmlFor="wl-start-date">Date started</Label>
                <Input id="wl-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              {startError && <p className="text-sm text-destructive">{startError}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {startError && <p className="text-sm text-destructive">{startError}</p>}
              <p className="text-sm text-muted-foreground">Could not load details for this title.</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeStart} disabled={!!busyKey}>Cancel</Button>
            <Button
              onClick={doStart}
              disabled={!!busyKey || detailsLoading || !details || (details?.media_type === "tv" && (!details.seasons || details.seasons.length === 0))}
            >
              {busyKey ? "Starting..." : "Start watching"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
