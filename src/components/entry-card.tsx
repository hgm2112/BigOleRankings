"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { ScoreChip } from "@/components/score-chip"
import { MediaTypeBadge } from "@/components/media-type-badge"
import { useCustomization } from "@/components/customization-provider"
import { Film, Tv, Trash2, Edit3, ChevronDown, ChevronUp } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Entry {
  id: string
  title: string
  media_type: string
  poster_path: string | null
  year: number | null
  gut_rating: number | null
  detailed_enjoyment: number | null
  detailed_impact: number | null
  detailed_recommend: number | null
  detailed_watch_again: number | null
  notes: string | null
  status?: string | null
  seasons?: { season_number: number; name: string | null; air_year: number | null; episode_count: number | null }[]
}

interface SeasonRating {
  media_id: string
  season_number: number
  rating: number | null
  dnf: boolean
}

interface EntryCardProps {
  entry: Entry
  onDelete?: (id: string) => void
  backQuery?: string
  readOnly?: boolean
  seasonRatings?: SeasonRating[]
}

export function EntryCard({ entry, onDelete, backQuery, readOnly = false, seasonRatings = [] }: EntryCardProps) {
  const [seasonsOpen, setSeasonsOpen] = useState(false)
  const { prefs } = useCustomization()
  const posterUrl = entry.poster_path
    ? `https://image.tmdb.org/t/p/w342${entry.poster_path}`
    : null

  const hasDetailed = entry.detailed_enjoyment !== null
  const detailedTotal = hasDetailed
    ? entry.detailed_enjoyment! + entry.detailed_impact! + entry.detailed_recommend! + entry.detailed_watch_again!
    : null

  const diff = hasDetailed && entry.gut_rating !== null ? detailedTotal! - entry.gut_rating : null

  const isTv = entry.media_type === "tv"
  const hasSeasons = isTv && (entry.seasons?.length ?? 0) > 0
  const seasonRatingMap = new Map(seasonRatings.map((sr) => [sr.season_number, sr]))

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-3">
        {posterUrl ? (
          <div className="relative w-[77px] h-[115px] rounded overflow-hidden bg-muted flex-shrink-0">
            <Image
              src={posterUrl}
              alt={entry.title}
              fill
              sizes="77px"
              quality={90}
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-[77px] h-[115px] rounded bg-muted flex items-center justify-center flex-shrink-0">
            {entry.media_type === "tv" ? <Tv className="h-6 w-6 text-muted-foreground" /> : <Film className="h-6 w-6 text-muted-foreground" />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/entries/${entry.id}${backQuery ? `?${backQuery}` : ""}`}
                  className="font-semibold hover:underline line-clamp-1"
                >
                  {entry.title}
                </Link>
                <StatusBadge status={entry.status ?? null} mediaType={entry.media_type} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{entry.year}</span>
                {prefs.media_badges ? (
                  <MediaTypeBadge type={entry.media_type} />
                ) : (
                  <span>{entry.media_type === "tv" ? "TV Show" : "Movie"}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Gut: </span>
              {prefs.score_chips ? (
                <ScoreChip value={entry.gut_rating} />
              ) : (
                <span className="font-medium">{entry.gut_rating ?? "—"}</span>
              )}
            </div>
            {hasDetailed && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Detailed: </span>
                {prefs.score_chips ? (
                  <ScoreChip value={detailedTotal} />
                ) : (
                  <span className="font-medium">{detailedTotal}</span>
                )}
                <span className="text-xs text-muted-foreground ml-1">
                  (Enjoyment: {entry.detailed_enjoyment}, Impact: {entry.detailed_impact}, Recommend: {entry.detailed_recommend}, Watch Again: {entry.detailed_watch_again})
                </span>
              </div>
            )}
          </div>

          {diff !== null && (
            <div className="flex items-center gap-4 text-sm mt-0.5">
              <div>
                <span className="text-muted-foreground">Diff: </span>
                <span className={`font-medium ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : ""}`}>
                  {diff > 0 ? "+" : ""}{diff}
                </span>
              </div>
            </div>
          )}

          {entry.notes && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{entry.notes}</p>
          )}

          <div className="flex items-center gap-1 mt-2">
            {hasSeasons && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setSeasonsOpen((o) => !o)}
                aria-expanded={seasonsOpen}
              >
                {seasonsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Seasons
              </Button>
            )}

            {!readOnly && (
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link href={`/entries/${entry.id}/edit`}>
                  <Edit3 className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}

            {!readOnly && onDelete && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Entry</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete "{entry.title}"? This cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button variant="destructive" onClick={() => onDelete(entry.id)}>Delete</Button>
                </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {seasonsOpen && hasSeasons && (
        <div className="border-t border-border/50 px-4 py-3 space-y-1.5">
          {entry.seasons!.map((s) => {
            const sr = seasonRatingMap.get(s.season_number)
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
                      <ScoreChip value={sr.rating} max={10} />
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
    </Card>
  )
}
