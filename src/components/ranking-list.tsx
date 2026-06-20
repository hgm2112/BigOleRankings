"use client"

import Image from "next/image"
import Link from "next/link"
import { Film, Tv } from "lucide-react"

interface RankedEntry {
  id: string
  title: string
  media_type: string
  poster_path: string | null
  year: number | null
  score: number
  gut_rating: number | null
}

interface RankingListProps {
  title: string
  entries: RankedEntry[]
  type?: "best" | "worst"
}

export function RankingList({ title, entries, type = "best" }: RankingListProps) {
  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm">{title}</h3>
      <div className="space-y-1">
        {entries.map((entry, index) => {
          const posterUrl = entry.poster_path
            ? `https://image.tmdb.org/t/p/w92${entry.poster_path}`
            : null

          return (
            <Link
              key={entry.id}
              href={`/entries/${entry.id}`}
              className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent transition-colors"
            >
              <span className={`text-sm font-bold w-5 text-right ${type === "worst" ? "text-destructive" : "text-green-600"}`}>
                {index + 1}
              </span>
              {posterUrl ? (
                <Image src={posterUrl} alt={entry.title} width={28} height={42} className="rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-[28px] h-[42px] rounded bg-muted flex items-center justify-center flex-shrink-0">
                  {entry.media_type === "tv" ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                </div>
              )}
              <span className="text-sm truncate flex-1">{entry.title}</span>
              <span className="text-sm font-medium tabular-nums">{entry.score}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
