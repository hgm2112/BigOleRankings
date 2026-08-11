"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { ScoreChip, scoreTextClass } from "@/components/score-chip"
import { MediaTypeBadge } from "@/components/media-type-badge"
import { useCustomization } from "@/components/customization-provider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit3, ArrowLeft, ClipboardList } from "lucide-react"
import { Film, Tv } from "lucide-react"

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
}

export function EntryDetailClient({
  entry,
  ownerProfile,
  isOwner,
  myComparisonEntry,
  followerRatings,
  backUrl,
  userId,
  seasons,
  seasonRatings,
  mySeasonRatings,
}: {
  entry: Entry
  ownerProfile: { username: string; display_name: string | null } | null
  isOwner: boolean
  myComparisonEntry: Entry | null
  followerRatings: FollowerRating[]
  backUrl?: string
  userId: string
  seasons: Season[]
  seasonRatings: SeasonRating[]
  mySeasonRatings: SeasonRating[]
}) {
  const { prefs } = useCustomization()
  const posterUrl = entry.poster_path
    ? `https://image.tmdb.org/t/p/w780${entry.poster_path}`
    : null

  const hasDetailed = entry.detailed_enjoyment !== null
  const detailedTotal = hasDetailed
    ? entry.detailed_enjoyment! + entry.detailed_impact! + entry.detailed_recommend! + entry.detailed_watch_again!
    : null
  const diff = hasDetailed && entry.gut_rating !== null ? detailedTotal! - entry.gut_rating : null

  const canRateSeasons = isOwner

  const [overview, setOverview] = useState<string | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState(false)
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [liveNextAirDate, setLiveNextAirDate] = useState<string | null>(null)
  const [localSeasonRatings, setLocalSeasonRatings] = useState<SeasonRating[]>(seasonRatings)

  const supabaseClient = createClient()

  const seasonRatingMap = new Map(localSeasonRatings.map((sr) => [sr.season_number, sr]))

  useEffect(() => {
    setLocalSeasonRatings(seasonRatings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id])

  const saveSeasonRating = async (seasonNumber: number, rating: number | null, dnf: boolean) => {
    const payload = {
      user_id: userId,
      media_id: entry.media_id,
      season_number: seasonNumber,
      rating,
      dnf,
      updated_at: new Date().toISOString(),
    }

    if (rating == null && !dnf) {
      const { error } = await supabaseClient
        .from("season_ratings")
        .delete()
        .eq("user_id", userId)
        .eq("media_id", entry.media_id)
        .eq("season_number", seasonNumber)
      if (error) {
        console.error("Failed to clear season rating", error)
        return
      }
      setLocalSeasonRatings((prev) => prev.filter((sr) => sr.season_number !== seasonNumber))
      return
    }

    const { error } = await supabaseClient
      .from("season_ratings")
      .upsert(payload, { onConflict: "user_id,media_id,season_number" })
    if (error) {
      console.error("Failed to save season rating", error)
      return
    }
    setLocalSeasonRatings((prev) => {
      const existing = prev.find((sr) => sr.season_number === seasonNumber)
      if (existing) {
        return prev.map((sr) => (sr.season_number === seasonNumber ? { ...sr, rating, dnf } : sr))
      }
      return [...prev, payload]
    })
  }

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

      <div className="flex gap-6 flex-col sm:flex-row">
        {posterUrl ? (
          <div className="relative w-40 sm:w-60 aspect-[2/3] rounded-lg overflow-hidden bg-muted flex-shrink-0 mx-auto sm:mx-0">
            <Image
              src={posterUrl}
              alt={entry.title}
              fill
              sizes="(min-width: 640px) 240px, 160px"
              quality={90}
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-40 sm:w-60 aspect-[2/3] rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
            {entry.media_type === "tv" ? <Tv className="h-10 w-10 text-muted-foreground" /> : <Film className="h-10 w-10 text-muted-foreground" />}
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{entry.title}</h1>
              <StatusBadge status={liveStatus ?? entry.status} mediaType={entry.media_type} nextAirDate={liveNextAirDate} />
            </div>
            <p className="text-muted-foreground flex items-center gap-2">
              {entry.year} &middot; {prefs.media_badges ? <MediaTypeBadge type={entry.media_type} /> : entry.media_type === "tv" ? "TV Show" : "Movie"}
            </p>
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
            <h2 className="font-semibold mb-2">Gut Rating</h2>
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-bold ${prefs.score_chips ? scoreTextClass(entry.gut_rating, 100) : ""}`}>{entry.gut_rating ?? "—"}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            {entry.gut_rated_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Rated on {new Date(entry.gut_rated_at).toLocaleDateString()}
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
                    Detailed rating on {new Date(entry.detailed_rated_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </>
          )}

          <Separator />
          <div>
            <h2 className="font-semibold mb-2">Tiebreaker Weight</h2>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{entry.weight}</span>
              <span className="text-sm text-muted-foreground">/100</span>
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

          {entry.notes && (
            <>
              <Separator />
              <div>
                <h2 className="font-semibold mb-1">Notes</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
              </div>
            </>
          )}
        </div>
      </div>

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
                  return (
                    <div key={s.season_number} className="flex items-center justify-between gap-3 flex-wrap border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">Season {s.season_number}</span>
                        {s.name && s.name !== `Season ${s.season_number}` && (
                          <span className="text-sm text-muted-foreground">({s.name})</span>
                        )}
                        {s.air_year != null && <span className="text-xs text-muted-foreground">{s.air_year}</span>}
                        {s.episode_count != null && <span className="text-xs text-muted-foreground">· {s.episode_count} episodes</span>}
                      </div>
                      {canRateSeasons ? (
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={sr?.dnf ?? false}
                              onChange={(e) => saveSeasonRating(s.season_number, sr?.rating ?? null, e.target.checked)}
                            />
                            DNF
                          </label>
                          <Select
                            value={sr?.rating != null ? String(sr.rating) : ""}
                            onValueChange={(v) => saveSeasonRating(s.season_number, v ? Number(v) : null, sr?.dnf ?? false)}
                          >
                            <SelectTrigger className="w-[90px] h-8">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                <SelectItem key={n} value={String(n)}>{n}/10</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-sm">
                          {sr?.dnf && <span className="font-medium text-destructive">DNF</span>}
                          {sr?.rating != null && (
                            prefs.score_chips ? (
                              <ScoreChip value={sr.rating} max={10} />
                            ) : (
                              <span className="font-medium">{sr.rating}/10</span>
                            )
                          )}
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
                      <ScoreChip value={fr.gut_rating} />
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
                              <ScoreChip value={frTotal} />
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
                            <ScoreChip value={myDetailedTotal} />
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
                            <ScoreChip value={sr.rating} max={10} />
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
