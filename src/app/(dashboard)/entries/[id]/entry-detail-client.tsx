"use client"

import { useState, useEffect, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { ScoreChip, scoreTextClass } from "@/components/score-chip"
import { MediaTypeBadge } from "@/components/media-type-badge"
import { useCustomization } from "@/components/customization-provider"
import { PosterLightbox } from "@/components/poster-lightbox"
import { formatDate } from "@/lib/format-date"
import { usePosterTheme } from "@/hooks/use-poster-theme"
import { Edit3, ArrowLeft, ClipboardList, ChevronDown, ChevronUp, Eye, Repeat } from "lucide-react"
import { Film, Tv } from "lucide-react"

type SeasonRewatchStat = { completed: number; ungroupedAdditional: number }
type RatingHistoryRow = {
  id: string
  season_number: number | null
  rating_scope: "movie_overall" | "tv_overall" | "tv_season"
  rating_kind: "gut" | "detailed" | "season"
  prev_gut: number | null
  new_gut: number | null
  prev_detailed_enjoyment: number | null
  prev_detailed_impact: number | null
  prev_detailed_recommend: number | null
  prev_detailed_watch_again: number | null
  new_detailed_enjoyment: number | null
  new_detailed_impact: number | null
  new_detailed_recommend: number | null
  new_detailed_watch_again: number | null
  prev_season_rating: number | null
  prev_season_dnf: boolean | null
  new_season_rating: number | null
  new_season_dnf: boolean | null
  changed_at: string
}

interface Entry {
  id: string
  user_id: string
  media_id: string
  title: string
  media_type: string
  poster_path: string | null
  year: number | null
  gut_rating: number | null
  gut_rated_at: string | null
  detailed_enjoyment: number | null
  detailed_impact: number | null
  detailed_recommend: number | null
  detailed_watch_again: number | null
  detailed_rated_at: string | null
  notes: string | null
  weight: number
  tmdb_id: number
  status: string | null
}

interface Season {
  season_number: number
  name: string | null
  air_year: number | null
  episode_count: number | null
}

interface SeasonRating {
  media_id: string
  season_number: number
  rating: number | null
  dnf: boolean
}

interface FollowerRating {
  username: string
  display_name: string | null
  gut_rating: number
  gut_rated_at: string | null
  detailed_enjoyment: number | null
  detailed_impact: number | null
  detailed_recommend: number | null
  detailed_watch_again: number | null
  detailed_rated_at: string | null
  season_ratings: { season_number: number; rating: number | null; dnf: boolean }[]
}

export function EntryDetailClient({
  entry,
  ownerProfile,
  isOwner,
  myComparisonEntry,
  followerRatings,
  backUrl,
  seasons,
  seasonRatings,
  mySeasonRatings,
  viewerCount,
  movieRewatchCount = 0,
  fullSeriesRewatchCount = 0,
  seasonRewatchStats = {},
  ratingHistory = [],
}: {
  entry: Entry
  ownerProfile: { username: string; display_name: string | null } | null
  isOwner: boolean
  myComparisonEntry: Entry | null
  followerRatings: FollowerRating[]
  backUrl?: string
  seasons: Season[]
  seasonRatings: SeasonRating[]
  mySeasonRatings: SeasonRating[]
  viewerCount: number
  movieRewatchCount?: number
  fullSeriesRewatchCount?: number
  seasonRewatchStats?: Record<number, SeasonRewatchStat>
  ratingHistory?: RatingHistoryRow[]
}) {
  const { prefs } = useCustomization()
  const posterUrl = entry.poster_path
    ? `https://image.tmdb.org/t/p/w780${entry.poster_path}`
    : null
  const palette = usePosterTheme(entry.poster_path, prefs.poster_themes)

  const hasDetailed = entry.detailed_enjoyment !== null
  const detailedTotal = hasDetailed
    ? entry.detailed_enjoyment! + entry.detailed_impact! + entry.detailed_recommend! + entry.detailed_watch_again!
    : null
  const diff = hasDetailed && entry.gut_rating !== null ? detailedTotal! - entry.gut_rating : null

  const [overview, setOverview] = useState<string | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState(false)
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [liveNextAirDate, setLiveNextAirDate] = useState<string | null>(null)
  const [expandedFollowers, setExpandedFollowers] = useState<Set<string>>(new Set())
  const [showOverallHistory, setShowOverallHistory] = useState(false)
  const [expandedSeasonHistory, setExpandedSeasonHistory] = useState<Set<number>>(new Set())

  const overallHistory = ratingHistory.filter((h) => h.rating_scope === "movie_overall" || h.rating_scope === "tv_overall")
  const seasonHistoryBySeason = new Map<number, RatingHistoryRow[]>()
  for (const h of ratingHistory) {
    if (h.rating_scope !== "tv_season" || h.season_number == null) continue
    const list = seasonHistoryBySeason.get(h.season_number) ?? []
    list.push(h)
    seasonHistoryBySeason.set(h.season_number, list)
  }

  const detailedTotalValue = (h: RatingHistoryRow, which: "prev" | "new") => {
    const e = which === "prev" ? h.prev_detailed_enjoyment : h.new_detailed_enjoyment
    const i = which === "prev" ? h.prev_detailed_impact : h.new_detailed_impact
    const r = which === "prev" ? h.prev_detailed_recommend : h.new_detailed_recommend
    const w = which === "prev" ? h.prev_detailed_watch_again : h.new_detailed_watch_again
    if (e == null || i == null || r == null || w == null) return null
    return e + i + r + w
  }

  const formatSeasonRatingState = (rating: number | null, dnf: boolean | null | undefined) => {
    if (dnf) return rating != null ? `${rating}/10 (DNF)` : "DNF"
    if (rating != null) return `${rating}/10`
    return "—"
  }

  const toggleFollowerSeasons = (username: string) => {
    setExpandedFollowers((prev) => {
      const next = new Set(prev)
      if (next.has(username)) {
        next.delete(username)
      } else {
        next.add(username)
      }
      return next
    })
  }

  const seasonRatingMap = new Map(seasonRatings.map((sr) => [sr.season_number, sr]))

  useEffect(() => {
    setOverviewLoading(true)
    setOverviewError(false)
    fetch(`/api/tmdb/details?id=${entry.tmdb_id}&type=${entry.media_type}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setOverview(data?.overview ?? null)
        if (!data?.overview) setOverviewError(true)
        if (data?.status != null) {
          setLiveStatus(data.status)
          setLiveNextAirDate(data.next_air_date ?? null)
        }
        setOverviewLoading(false)
      })
      .catch(() => {
        setOverview(null)
        setOverviewError(true)
        setOverviewLoading(false)
      })
  }, [entry.tmdb_id, entry.media_type, entry.id])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={backUrl ?? "/entries"}><ArrowLeft className="h-4 w-4 mr-1" />Back to entries</Link>
      </Button>

      <div
        className={
          palette
            ? "rounded-xl border bg-card overflow-hidden shadow"
            : undefined
        }
        style={
          palette
            ? {
                borderColor: palette.glow,
                boxShadow: `0 0 16px ${palette.glow}`,
                backgroundImage: `linear-gradient(${palette.wash}, ${palette.wash})`,
              }
            : undefined
        }
      >
        {palette && <div className="h-2" style={{ backgroundColor: palette.accent }} />}
        <div className={`flex gap-6 flex-col sm:flex-row${palette ? " p-4" : ""}`}>
          {posterUrl ? (
          <PosterLightbox posterPath={entry.poster_path} alt={entry.title} className="block rounded-lg overflow-hidden flex-shrink-0 mx-auto sm:mx-0">
            <div className="relative w-40 h-60 sm:w-[290px] sm:h-auto sm:self-stretch sm:min-h-[435px] bg-muted">
              <Image
                src={posterUrl}
                alt={entry.title}
                fill
                sizes="(min-width: 640px) 290px, 160px"
                quality={90}
                className="object-cover"
              />
            </div>
          </PosterLightbox>
        ) : (
          <div className="w-40 h-60 sm:w-[290px] sm:h-auto sm:self-stretch sm:min-h-[435px] rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
            {entry.media_type === "tv" ? <Tv className="h-10 w-10 text-muted-foreground" /> : <Film className="h-10 w-10 text-muted-foreground" />}
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{entry.title}</h1>
              <StatusBadge status={liveStatus ?? entry.status} mediaType={entry.media_type} nextAirDate={liveNextAirDate} />
              <span
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-muted/50 text-muted-foreground whitespace-nowrap"
                title={`${viewerCount} ${viewerCount === 1 ? "user" : "users"} watched this`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="tabular-nums">{viewerCount}</span>
              </span>
            </div>
            <p className="text-muted-foreground flex items-center gap-2">
              {entry.year} &middot; {prefs.media_badges ? <MediaTypeBadge type={entry.media_type} /> : entry.media_type === "tv" ? "TV Show" : "Movie"}
            </p>
            {entry.media_type === "tv" && fullSeriesRewatchCount > 0 && (
              <div className="mt-1">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`Full-series rewatches: ${fullSeriesRewatchCount}`}>
                  <span>Full-Series Rewatches:</span>
                  <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="tabular-nums">{fullSeriesRewatchCount}</span>
                </span>
              </div>
            )}
            {!isOwner && ownerProfile && (
              <p className="text-sm text-muted-foreground mt-1">
                Entry by <span className="font-medium">{ownerProfile.display_name || ownerProfile.username}</span>
              </p>
            )}
          </div>

          {isOwner && (
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/entries/${entry.id}/edit`}><Edit3 className="h-4 w-4 mr-1" />Edit</Link>
              </Button>
              {!hasDetailed && (
                <Button size="sm" asChild>
                  <Link href={`/entries/${entry.id}/detailed`}><ClipboardList className="h-4 w-4 mr-1" />Add Detailed Rating</Link>
                </Button>
              )}
            </div>
          )}

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-semibold">Gut Rating</h2>
              {entry.media_type === "movie" && movieRewatchCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${movieRewatchCount} rewatch${movieRewatchCount === 1 ? "" : "es"}`}>
                  <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="tabular-nums">{movieRewatchCount}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-bold ${prefs.score_chips ? scoreTextClass(entry.gut_rating, 100) : ""}`}>{entry.gut_rating ?? "—"}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            {entry.gut_rated_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Rated on {formatDate(entry.gut_rated_at)}
              </p>
            )}
          </div>

          {hasDetailed && (
            <>
              <Separator />
              <div>
                <h2 className="font-semibold mb-2">Detailed Rating</h2>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-bold ${prefs.score_chips ? scoreTextClass(detailedTotal, 100) : ""}`}>{detailedTotal}</span>
                  <span className="text-sm text-muted-foreground">/100</span>
                  {diff !== null && (
                    <span className={`text-sm font-medium ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      ({diff > 0 ? "+" : ""}{diff} from gut)
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between max-w-xs">
                    <span className="text-muted-foreground">Enjoyment:</span>
                    <span className="font-medium">{entry.detailed_enjoyment}/60</span>
                  </div>
                  <div className="flex justify-between max-w-xs">
                    <span className="text-muted-foreground">Impact:</span>
                    <span className="font-medium">{entry.detailed_impact}/20</span>
                  </div>
                  <div className="flex justify-between max-w-xs">
                    <span className="text-muted-foreground">Recommend:</span>
                    <span className="font-medium">{entry.detailed_recommend}/10</span>
                  </div>
                  <div className="flex justify-between max-w-xs">
                    <span className="text-muted-foreground">Watch Again:</span>
                    <span className="font-medium">{entry.detailed_watch_again}/10</span>
                  </div>
                </div>
                {entry.detailed_rated_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Detailed rating on {formatDate(entry.detailed_rated_at)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      </div>

      <Separator />
      <div>
        <h2 className="font-semibold mb-1">Synopsis</h2>
        {overviewLoading ? (
          <p className="text-sm text-muted-foreground italic">Loading synopsis...</p>
        ) : overviewError ? (
          <p className="text-sm text-muted-foreground italic">Could not load synopsis</p>
        ) : (
          <p className="text-sm text-muted-foreground">{overview}</p>
        )}
      </div>

      {overallHistory.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="font-semibold mb-1">Rating History</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowOverallHistory((v) => !v)}
            >
              {showOverallHistory ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
              {showOverallHistory ? "Hide" : "Show"} ({overallHistory.length})
            </Button>
            {showOverallHistory && (
              <div className="mt-2 space-y-1.5 text-xs text-muted-foreground border-l pl-3">
                {overallHistory.map((h) => (
                  <div key={h.id}>
                    <span className="font-medium text-foreground">{formatDate(h.changed_at)}:</span>{" "}
                    {h.rating_kind === "gut" ? (
                      <>Gut changed {h.prev_gut}/100 → {h.new_gut}/100</>
                    ) : h.rating_kind === "detailed" ? (
                      <>Detailed changed {detailedTotalValue(h, "prev") ?? "—"}/100 → {detailedTotalValue(h, "new") ?? "—"}/100</>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {entry.weight > 0 && (
        <>
          <Separator />
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2">
              <h2 className="text-sm">Tiebreaker Weight</h2>
              <span className="text-sm">{entry.weight}</span>
            </div>
          </div>
        </>
      )}

      {entry.notes && (
        <>
          <Separator />
          <div>
            <h2 className="font-semibold mb-1">Notes</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
          </div>
        </>
      )}

      {entry.media_type === "tv" && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3">Seasons</h2>
            {seasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No season data yet. Check back after the next refresh.</p>
            ) : (
              <div className="space-y-3">
                {seasons.map((s) => {
                  const sr = seasonRatingMap.get(s.season_number)
                  const sHist = seasonHistoryBySeason.get(s.season_number) ?? []
                  const sStat = seasonRewatchStats[s.season_number]
                  const expanded = expandedSeasonHistory.has(s.season_number)

                  const ratingNode = sr?.dnf ? (
                    <span className="font-medium text-destructive">DNF</span>
                  ) : sr?.rating != null ? (
                    prefs.score_chips ? (
                      <ScoreChip value={sr.rating} max={10} tint={palette?.chip} />
                    ) : (
                      <span className="font-medium">{sr.rating}/10</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )

                  const rewatchNode = sStat ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${sStat.ungroupedAdditional} additional completed viewing${sStat.ungroupedAdditional === 1 ? "" : "s"} not grouped into a full-series rewatch`}>
                      <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="tabular-nums">{sStat.ungroupedAdditional}</span>
                    </span>
                  ) : null

                  const mobileHistoryButton = sHist.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs"
                      onClick={() => {
                        setExpandedSeasonHistory((prev) => {
                          const next = new Set(prev)
                          if (next.has(s.season_number)) next.delete(s.season_number)
                          else next.add(s.season_number)
                          return next
                        })
                      }}
                    >
                      {expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                      History ({sHist.length})
                    </Button>
                  ) : null

                  const mobileLine2Left: ReactNode[] = []
                  if (s.air_year != null) {
                    mobileLine2Left.push(<span key="year" className="text-xs text-muted-foreground">{s.air_year}</span>)
                  }
                  if (s.episode_count != null) {
                    if (mobileLine2Left.length > 0) mobileLine2Left.push(<span key="sep-e" className="text-muted-foreground">•</span>)
                    mobileLine2Left.push(<span key="eps" className="text-xs text-muted-foreground">{s.episode_count} eps</span>)
                  }

                  return (
                    <div key={s.season_number} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      {/* Mobile */}
                      <div className="sm:hidden space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Season {s.season_number}</span>
                          <div className="flex-1 flex justify-center">{mobileHistoryButton}</div>
                          <div className="inline-flex items-center text-sm justify-end">{ratingNode}</div>
                        </div>
                        {(mobileLine2Left.length > 0 || rewatchNode) && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">{mobileLine2Left}</div>
                            {rewatchNode ? <div className="ml-auto">{rewatchNode}</div> : null}
                          </div>
                        )}
                      </div>

                      {/* Desktop */}
                      <div className="hidden sm:flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-medium">Season {s.season_number}</span>
                          {s.name && s.name !== `Season ${s.season_number}` && (
                            <span className="text-sm text-muted-foreground">({s.name})</span>
                          )}
                          {s.air_year != null && <span className="text-xs text-muted-foreground">{s.air_year}</span>}
                          {s.episode_count != null && (
                            <span className="text-xs text-muted-foreground">· {s.episode_count} episodes</span>
                          )}
                          {sHist.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setExpandedSeasonHistory((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(s.season_number)) next.delete(s.season_number)
                                  else next.add(s.season_number)
                                  return next
                                })
                              }}
                            >
                              {expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                              Rating History ({sHist.length})
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          {sStat && rewatchNode}
                          {ratingNode}
                        </div>
                      </div>

                      {sHist.length > 0 && expanded && (
                        <div className="mt-1 space-y-1.5 text-xs text-muted-foreground border-l pl-3">
                          {sHist.map((h) => (
                            <div key={h.id}>
                              <span className="font-medium text-foreground">{formatDate(h.changed_at)}:</span>{" "}
                              Changed {formatSeasonRatingState(h.prev_season_rating, h.prev_season_dnf)} → {formatSeasonRatingState(h.new_season_rating, h.new_season_dnf)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isOwner && followerRatings.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3">Followers&apos; Ratings</h2>
            <div className="space-y-3">
              {followerRatings.map((fr, idx) => (
                <div key={idx}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link href={`/users/${fr.username}`} className="font-medium hover:underline">
                      {fr.display_name || fr.username}
                    </Link>
                    <span className="text-muted-foreground">rated</span>
                    {prefs.score_chips ? (
                      <ScoreChip value={fr.gut_rating} tint={palette?.chip} />
                    ) : (
                      <span className="font-medium">{fr.gut_rating}</span>
                    )}
                    <span className="text-xs text-muted-foreground">/100</span>
                    {entry.gut_rating != null && (
                      <span className={`font-medium ${fr.gut_rating > entry.gut_rating ? "text-green-600" : fr.gut_rating < entry.gut_rating ? "text-destructive" : ""}`}>
                        Δ {fr.gut_rating - entry.gut_rating > 0 ? "+" : ""}{fr.gut_rating - entry.gut_rating}
                      </span>
                    )}
                  </div>
                  {fr.detailed_enjoyment != null && entry.detailed_enjoyment != null && (
                    <div className="flex gap-x-3 items-baseline text-sm flex-wrap mt-1">
                      {(() => {
                        const frTotal = fr.detailed_enjoyment! + (fr.detailed_impact ?? 0) + (fr.detailed_recommend ?? 0) + (fr.detailed_watch_again ?? 0)
                        const myTotal = entry.detailed_enjoyment! + (entry.detailed_impact ?? 0) + (entry.detailed_recommend ?? 0) + (entry.detailed_watch_again ?? 0)
                        const diff = frTotal - myTotal
                        return (
                          <>
                            <span className="text-muted-foreground text-xs">Detailed:</span>
                            {prefs.score_chips ? (
                              <ScoreChip value={frTotal} tint={palette?.chip} />
                            ) : (
                              <span className="font-medium tabular-nums">{frTotal}/100</span>
                            )}
                            <span className="text-xs text-muted-foreground tabular-nums">E {fr.detailed_enjoyment}/60</span>
                            <span className="text-xs text-muted-foreground tabular-nums">I {fr.detailed_impact ?? 0}/20</span>
                            <span className="text-xs text-muted-foreground tabular-nums">R {fr.detailed_recommend ?? 0}/10</span>
                            <span className="text-xs text-muted-foreground tabular-nums">W {fr.detailed_watch_again ?? 0}/10</span>
                            <span className={`font-medium tabular-nums ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : ""}`}>
                              Δ {diff > 0 ? "+" : ""}{diff}
                            </span>
                          </>
                        )
                      })()}
                    </div>
                  )}
                  {entry.media_type === "tv" && fr.season_ratings.length > 0 && (
                    <div className="mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => toggleFollowerSeasons(fr.username)}
                        aria-expanded={expandedFollowers.has(fr.username)}
                      >
                        {expandedFollowers.has(fr.username) ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        Season ratings
                      </Button>
                      {expandedFollowers.has(fr.username) && (
                        <div className="border-t border-border/50 pt-2 mt-1 space-y-1.5">
                          {seasons.map((s) => {
                            const sr = fr.season_ratings.find((x) => x.season_number === s.season_number)
                            return (
                              <div key={s.season_number} className="flex items-center gap-2 text-sm flex-wrap">
                                <span className="font-medium">Season {s.season_number}</span>
                                {s.name && s.name !== `Season ${s.season_number}` && (
                                  <span className="text-xs text-muted-foreground">({s.name})</span>
                                )}
                                {s.air_year != null && <span className="text-xs text-muted-foreground">{s.air_year}</span>}
                                {s.episode_count != null && <span className="text-xs text-muted-foreground">· {s.episode_count} episodes</span>}
                                <span className="ml-auto flex items-center gap-2">
                                  {sr?.dnf && <span className="font-medium text-destructive">DNF</span>}
                                  {sr?.rating != null ? (
                                    prefs.score_chips ? (
                              <ScoreChip value={sr.rating} max={10} tint={palette?.chip} />
                                    ) : (
                                      <span className="font-medium tabular-nums">{sr.rating}/10</span>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {idx < followerRatings.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isOwner && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3">Your Rating</h2>
            {myComparisonEntry ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <Link href={`/entries/${myComparisonEntry.id}`} className="hover:underline">
                    <span className="text-muted-foreground">You rated: </span>
                    <span className="font-medium">{myComparisonEntry.gut_rating ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </Link>
                  {entry.gut_rating != null && myComparisonEntry.gut_rating != null && (
                    <div>
                      <span className="text-muted-foreground">Δ </span>
                      <span className={`font-medium ${myComparisonEntry.gut_rating > entry.gut_rating ? "text-green-600" : myComparisonEntry.gut_rating < entry.gut_rating ? "text-destructive" : ""}`}>
                        {myComparisonEntry.gut_rating - entry.gut_rating > 0 ? "+" : ""}{myComparisonEntry.gut_rating - entry.gut_rating}
                      </span>
                    </div>
                  )}
                </div>

                {myComparisonEntry.detailed_enjoyment != null && (
                  <div className="space-y-1">
                    {(() => {
                      const myDetailedTotal = myComparisonEntry.detailed_enjoyment! + (myComparisonEntry.detailed_impact ?? 0) + (myComparisonEntry.detailed_recommend ?? 0) + (myComparisonEntry.detailed_watch_again ?? 0)
                      const entryHasDetailed = entry.detailed_enjoyment != null
                      const entryDetailedTotal = entryHasDetailed
                        ? entry.detailed_enjoyment! + (entry.detailed_impact ?? 0) + (entry.detailed_recommend ?? 0) + (entry.detailed_watch_again ?? 0)
                        : 0
                      const diff = entryHasDetailed ? myDetailedTotal - entryDetailedTotal : 0

                      return (
                        <div className="flex gap-x-3 items-baseline text-sm flex-wrap">
                          <span className="text-muted-foreground">Detailed:</span>
                          {prefs.score_chips ? (
                            <ScoreChip value={myDetailedTotal} tint={palette?.chip} />
                          ) : (
                            <span className="font-medium tabular-nums">{myDetailedTotal}/100</span>
                          )}
                          <span className="text-xs text-muted-foreground tabular-nums">E {myComparisonEntry.detailed_enjoyment}/60</span>
                          <span className="text-xs text-muted-foreground tabular-nums">I {myComparisonEntry.detailed_impact ?? 0}/20</span>
                          <span className="text-xs text-muted-foreground tabular-nums">R {myComparisonEntry.detailed_recommend ?? 0}/10</span>
                          <span className="text-xs text-muted-foreground tabular-nums">W {myComparisonEntry.detailed_watch_again ?? 0}/10</span>
                          {entryHasDetailed && (
                            <span className={`font-medium tabular-nums ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : ""}`}>
                              {diff > 0 ? "+" : ""}{diff}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You haven't rated this yet.{" "}
                <Link href={`/entries/new?tmdb_id=${entry.tmdb_id}&media_type=${entry.media_type}&title=${encodeURIComponent(entry.title)}${entry.year != null ? `&year=${entry.year}` : ""}${entry.poster_path ? `&poster_path=${encodeURIComponent(entry.poster_path)}` : ""}`} className="underline hover:text-foreground">
                  Add your rating
                </Link>
              </p>
            )}
            {mySeasonRatings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <h3 className="font-semibold mb-2">Season Ratings</h3>
                <div className="space-y-1.5">
                  {mySeasonRatings.map((sr) => {
                    const season = seasons.find((s) => s.season_number === sr.season_number)
                    return (
                      <div key={sr.season_number} className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-medium">Season {sr.season_number}</span>
                        {season?.name && season.name !== `Season ${sr.season_number}` && (
                          <span className="text-xs text-muted-foreground">({season.name})</span>
                        )}
                        {sr.dnf && <span className="font-medium text-destructive">DNF</span>}
                        {sr.rating != null && (
                          prefs.score_chips ? (
                            <ScoreChip value={sr.rating} max={10} tint={palette?.chip} />
                          ) : (
                            <span className="font-medium">{sr.rating}/10</span>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
