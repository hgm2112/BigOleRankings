"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Edit3, ArrowLeft, ClipboardList } from "lucide-react"
import { Film, Tv } from "lucide-react"

interface Entry {
  id: string
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
}

export function EntryDetailClient({ entry }: { entry: Entry }) {
  const posterUrl = entry.poster_path
    ? `https://image.tmdb.org/t/p/w342${entry.poster_path}`
    : null

  const hasDetailed = entry.detailed_enjoyment !== null
  const detailedTotal = hasDetailed
    ? entry.detailed_enjoyment! + entry.detailed_impact! + entry.detailed_recommend! + entry.detailed_watch_again!
    : null
  const diff = hasDetailed && entry.gut_rating !== null ? detailedTotal! - entry.gut_rating : null

  const [overview, setOverview] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/tmdb/details?id=${entry.tmdb_id}&type=${entry.media_type}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setOverview(data?.overview ?? null))
      .catch(() => setOverview(null))
  }, [entry.tmdb_id, entry.media_type])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/entries"><ArrowLeft className="h-4 w-4 mr-1" />Back to entries</Link>
      </Button>

      <div className="flex gap-6 flex-col sm:flex-row">
        {posterUrl ? (
          <Image src={posterUrl} alt={entry.title} width={185} height={278} className="rounded-lg object-cover flex-shrink-0 mx-auto sm:mx-0" />
        ) : (
          <div className="w-[185px] h-[278px] rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
            {entry.media_type === "tv" ? <Tv className="h-10 w-10 text-muted-foreground" /> : <Film className="h-10 w-10 text-muted-foreground" />}
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{entry.title}</h1>
            <p className="text-muted-foreground">
              {entry.year} &middot; {entry.media_type === "tv" ? "TV Show" : entry.media_type === "misc" ? "Misc" : "Movie"}
            </p>
          </div>

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

          <Separator />

          <div>
            <h2 className="font-semibold mb-2">Gut Rating</h2>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{entry.gut_rating ?? "—"}</span>
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
                  <span className="text-3xl font-bold">{detailedTotal}</span>
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

          {overview && (
            <>
              <Separator />
              <div>
                <h2 className="font-semibold mb-1">Synopsis</h2>
                <p className="text-sm text-muted-foreground">{overview}</p>
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
        </div>
      </div>
    </div>
  )
}
