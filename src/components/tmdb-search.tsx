"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { PosterLightbox } from "@/components/poster-lightbox"
import { Search, Film, Tv, BookmarkCheck, BookmarkPlus, X } from "lucide-react"
import { MediaTypeBadge } from "@/components/media-type-badge"

export interface TMDBResult {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: string
  media_type: "movie" | "tv" | string
  overview: string
  runtime?: number | null
  already_rated?: boolean
  entry_id?: string | null
  on_watchlist?: boolean
  eligible_for_watchlist?: boolean
  ineligible_reason?: "already_on_watchlist" | "currently_watching" | "already_watched_or_rated" | null
  season_count?: number | null
}

interface TMDBSearchProps {
  onSelect: (item: TMDBResult) => void
  onAddToWatchlist?: (item: TMDBResult) => Promise<void> | void
  selectionMode?: "rating" | "watching" | "watchlist"
}

function reasonLabel(reason: TMDBResult["ineligible_reason"]): string | null {
  switch (reason) {
    case "currently_watching":
      return "Currently watching"
    case "already_watched_or_rated":
      return "Already watched or rated"
    case "already_on_watchlist":
      return "Already on Watchlist"
    default:
      return null
  }
}

export function TMDSearch({ onSelect, onAddToWatchlist, selectionMode = "rating" }: TMDBSearchProps) {
  const [query, setQuery] = useState("")
  const [type, setType] = useState("movie")
  const [results, setResults] = useState<TMDBResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const runSearch = async (q: string, t: string) => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setSearched(true)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(q)}&type=${encodeURIComponent(t)}`, {
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Search failed")
      setResults((data.results || []) as TMDBResult[])
    } catch (e: any) {
      if (e?.name === "AbortError") return
      setResults([])
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    if (selectionMode !== "watchlist") return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      runSearch(q, "all")
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectionMode])

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (selectionMode === "watchlist") {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      await runSearch(query, "all")
      return
    }
    if (!query.trim()) return
    await runSearch(query, type)
  }

  const posterUrl = (path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w185${path}` : null

  const updateResult = (tmdb_id: number, media_type: string, patch: Partial<TMDBResult>) => {
    setResults((prev) =>
      prev.map((r) => (r.tmdb_id === tmdb_id && r.media_type === media_type ? { ...r, ...patch } : r))
    )
  }

  const handleWatchlistAdd = async (item: TMDBResult) => {
    if (!onAddToWatchlist) return
    const key = `${item.media_type}:${item.tmdb_id}`
    setAddingKey(key)
    try {
      await onAddToWatchlist(item)
      updateResult(item.tmdb_id, item.media_type, {
        on_watchlist: true,
        eligible_for_watchlist: false,
        ineligible_reason: "already_on_watchlist",
      })
    } finally {
      setAddingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSearch}
        className={
          selectionMode === "watchlist"
            ? "grid grid-cols-1 gap-2"
            : "grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] gap-x-2 gap-y-2 items-center"
        }
      >
        <Label
          htmlFor="search"
          className={selectionMode === "watchlist" ? "sr-only" : "col-span-2 sm:col-span-1 sm:col-start-1 sm:row-start-1"}
        >
          Search
        </Label>
        <div className={selectionMode === "watchlist" ? "relative" : "relative col-span-2 sm:col-span-1 sm:col-start-1 sm:row-start-2"}>
          <Input
            ref={inputRef}
            id="search"
            className={`select-text ${selectionMode === "watchlist" && query ? "pr-9" : ""}`}
            placeholder={selectionMode === "watchlist" ? "Search movies and TV shows..." : "Search for a movie or TV show..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {selectionMode === "watchlist" && query && (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (debounceRef.current) clearTimeout(debounceRef.current)
                abortRef.current?.abort()
                setQuery("")
                setResults([])
                setSearched(false)
                setLoading(false)
                inputRef.current?.focus()
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {selectionMode !== "watchlist" && (
          <>
            <Label htmlFor="type" className="col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type" className="sm:col-start-2 sm:row-start-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="movie">Movie</SelectItem>
                <SelectItem value="tv">TV Show</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" className="sm:col-start-3 sm:row-start-2" disabled={loading || !query.trim()}>
              <Search className="h-4 w-4 mr-1" />
              {loading ? "Searching..." : "Search"}
            </Button>
          </>
        )}
      </form>

      {loading && <p className="text-sm text-muted-foreground">Searching...</p>}

      {!loading && searched && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No results found.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.map((item) => {
            const poster = posterUrl(item.poster_path)
            const key = `${item.media_type}:${item.tmdb_id}`
            if (selectionMode === "watchlist") {
              const onWatchlist = !!item.on_watchlist || item.ineligible_reason === "already_on_watchlist"
              const eligible = item.eligible_for_watchlist !== false && !onWatchlist
              const label = reasonLabel(item.ineligible_reason ?? (onWatchlist ? "already_on_watchlist" : null))
              return (
                <Card key={key} className="flex items-center gap-3 p-3">
                  {poster ? (
                    <PosterLightbox posterPath={item.poster_path} alt={item.title} className="block rounded flex-shrink-0">
                      <Image src={poster} alt={item.title} width={46} height={69} quality={90} className="rounded object-cover" />
                    </PosterLightbox>
                  ) : (
                    <div className="w-[46px] h-[69px] rounded bg-muted flex items-center justify-center flex-shrink-0">
                      {item.media_type === "tv" ? <Tv className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <MediaTypeBadge type={item.media_type} />
                      {item.media_type === "tv" && (item.season_count ?? 0) > 0 && (
                        <span>{item.season_count} season{item.season_count === 1 ? "" : "s"}</span>
                      )}
                      {item.year && <span>{item.year}</span>}
                    </div>
                    {item.overview && (
                      <p className="hidden sm:line-clamp-1 text-xs text-muted-foreground mt-0.5">{item.overview}</p>
                    )}
                    {!eligible && label && (
                      <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    {eligible ? (
                      <Button
                        size="sm"
                        onClick={() => handleWatchlistAdd(item)}
                        disabled={addingKey === key}
                      >
                        <BookmarkPlus className="h-4 w-4 mr-1" />
                        {addingKey === key ? "Adding..." : "Add to Watchlist"}
                      </Button>
                    ) : onWatchlist ? (
                      <Button size="sm" variant="outline" disabled>
                        <BookmarkCheck className="h-4 w-4 mr-1" />
                        Already added
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        {label || "Not eligible"}
                      </Button>
                    )}
                  </div>
                </Card>
              )
            }

            const canSelect = !item.already_rated || selectionMode === "watching"
            return (
              <Card
                key={item.tmdb_id}
                className={`flex items-center gap-3 p-3 transition-colors ${
                  canSelect ? "cursor-pointer hover:bg-accent" : "cursor-default opacity-80"
                }`}
                onClick={() => {
                  if (canSelect) onSelect(item)
                }}
              >
                {poster ? (
                  <PosterLightbox posterPath={item.poster_path} alt={item.title} className="block rounded flex-shrink-0">
                    <Image src={poster} alt={item.title} width={46} height={69} quality={90} className="rounded object-cover" />
                  </PosterLightbox>
                ) : (
                  <div className="w-[46px] h-[69px] rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {item.media_type === "tv" ? <Tv className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>{item.year}</span>
                    <span>{item.media_type === "tv" ? "TV Show" : "Movie"}</span>
                    {item.already_rated && (
                      <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-medium">
                        {selectionMode === "watching" ? "Rated" : "Already rated"}
                      </span>
                    )}
                  </div>
                  {item.overview && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.overview}</p>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                  {item.already_rated ? (
                    selectionMode === "watching" ? (
                      <>
                        {item.entry_id && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/entries/${item.entry_id}`} onClick={(e) => e.stopPropagation()}>
                              View rating
                            </Link>
                          </Button>
                        )}
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); onSelect(item) }}>
                          Select
                        </Button>
                      </>
                    ) : item.entry_id ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/entries/${item.entry_id}`} onClick={(e) => e.stopPropagation()}>
                          View rating
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        Already rated
                      </Button>
                    )
                  ) : (
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); onSelect(item) }}>
                      Select
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
