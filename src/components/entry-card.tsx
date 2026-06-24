"use client"

import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Film, Tv, Trash2, Edit3 } from "lucide-react"
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
}

interface EntryCardProps {
  entry: Entry
  onDelete?: (id: string) => void
}

export function EntryCard({ entry, onDelete }: EntryCardProps) {
  const posterUrl = entry.poster_path
    ? `https://image.tmdb.org/t/p/w154${entry.poster_path}`
    : null

  const hasDetailed = entry.detailed_enjoyment !== null
  const detailedTotal = hasDetailed
    ? entry.detailed_enjoyment! + entry.detailed_impact! + entry.detailed_recommend! + entry.detailed_watch_again!
    : null

  const diff = hasDetailed && entry.gut_rating !== null ? detailedTotal! - entry.gut_rating : null

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-3">
        {posterUrl ? (
          <Image src={posterUrl} alt={entry.title} width={77} height={115} className="rounded object-contain flex-shrink-0 bg-muted" />
        ) : (
          <div className="w-[77px] h-[115px] rounded bg-muted flex items-center justify-center flex-shrink-0">
            {entry.media_type === "tv" ? <Tv className="h-6 w-6 text-muted-foreground" /> : <Film className="h-6 w-6 text-muted-foreground" />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link href={`/entries/${entry.id}`} className="font-semibold hover:underline line-clamp-1">
                {entry.title}
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{entry.year}</span>
                <span>{entry.media_type === "tv" ? "TV Show" : entry.media_type === "misc" ? "Misc" : "Movie"}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Gut: </span>
              <span className="font-medium">{entry.gut_rating ?? "—"}</span>
            </div>
            {hasDetailed && (
              <div>
                <span className="text-muted-foreground">Detailed: </span>
                <span className="font-medium">{detailedTotal}</span>
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
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href={`/entries/${entry.id}/edit`}>
                <Edit3 className="h-3.5 w-3.5" />
              </Link>
            </Button>

            {onDelete && (
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
    </Card>
  )
}
