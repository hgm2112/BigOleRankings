"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { TMDSearch } from "@/components/tmdb-search"
import { GutRatingForm } from "@/components/gut-rating-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface TMDBResult {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: string
  media_type: string
  genres?: string[]
  runtime?: number | null
  episode_runtime?: number | null
  status?: string | null
  next_air_date?: string | null
  network?: string | null
  seasons?: {
    season_number: number
    name: string | null
    air_year: number | null
    episode_count: number
  }[]
}

function formatRuntime(minutes: number | null): string | null {
  if (minutes == null) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export default function NewEntryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<TMDBResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gutRating, setGutRating] = useState(50)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    const tmdbId = searchParams.get("tmdb_id")
    const mediaType = searchParams.get("media_type")
    if (!tmdbId || !mediaType) return
    const item: TMDBResult = {
      tmdb_id: Number(tmdbId),
      media_type: mediaType,
      title: searchParams.get("title") || "",
      year: searchParams.get("year") || "",
      poster_path: searchParams.get("poster_path") || null,
    }
    setSelected({ ...item, runtime: null })
    fetch(`/api/tmdb/details?id=${item.tmdb_id}&type=${item.media_type}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((details) => {
        if (details) setSelected(details)
      })
      .catch(() => {})
  }, [searchParams])

  const handleSelect = async (item: TMDBResult) => {
    setSelected({ ...item, runtime: null })
    try {
      const res = await fetch(`/api/tmdb/details?id=${item.tmdb_id}&type=${item.media_type}`)
      if (res.ok) {
        const details = await res.json()
        setSelected(details)
      }
    } catch {
      // fall through with null runtime
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdb_id: selected!.tmdb_id,
        media_type: selected!.media_type,
        title: selected!.title,
        poster_path: selected!.poster_path,
        year: selected!.year ? parseInt(selected!.year) : null,
        genres: selected!.genres ?? null,
        gut_rating: gutRating,
        notes,
        runtime: selected!.runtime,
        status: selected!.status ?? null,
        next_air_date: selected!.next_air_date ?? null,
        episode_runtime: selected!.episode_runtime ?? null,
        network: selected!.network ?? null,
        seasons: selected!.seasons ?? null,
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error || "Failed to save entry")
      setLoading(false)
      return
    }

    router.push("/entries")
    router.refresh()
  }

  if (selected) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back to search
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{selected.title}</CardTitle>
            <CardDescription>
              {selected.year} &middot; {selected.media_type === "tv" ? "TV Show" : "Movie"}
              {selected.media_type === "tv" && selected.episode_runtime != null && <> &middot; {formatRuntime(selected.episode_runtime)}/episode</>}
              {selected.media_type !== "tv" && selected.runtime != null && <> &middot; {formatRuntime(selected.runtime)}</>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <GutRatingForm
                gutRating={gutRating}
                notes={notes}
                onGutRatingChange={setGutRating}
                onNotesChange={setNotes}
              />
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Trust your gut. Or don&apos;t... but here is where you can decide what quick rating you would give this show or movie. This is a way to express your overall impression of an entry. Try not to be rash... but trust your intuition. Hint: there is always the detailed rating. Come back in about a week and break it down by enjoyment, impact, recommend, and watch again.
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Rating"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Add New Rating</h1>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/entries"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
          </Button>
        </div>
        <p className="text-muted-foreground">Hey whatcha got there? Something new?</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <TMDSearch onSelect={handleSelect} />
        </CardContent>
      </Card>
    </div>
  )
}
