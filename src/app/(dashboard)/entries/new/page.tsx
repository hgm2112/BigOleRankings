"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TMDSearch } from "@/components/tmdb-search"
import { GutRatingForm } from "@/components/gut-rating-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface TMDBResult {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: string
  media_type: string
  runtime?: number | null
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
  const [selected, setSelected] = useState<TMDBResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [weight, setWeight] = useState(0)
  const [gutRating, setGutRating] = useState(50)
  const [notes, setNotes] = useState("")

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
        gut_rating: gutRating,
        weight,
        notes,
        runtime: selected!.runtime,
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
              {selected.year} &middot; {selected.media_type === "tv" ? "TV Show" : selected.media_type === "misc" ? "Misc" : "Movie"}
              {selected.runtime != null && <> &middot; {formatRuntime(selected.runtime)}</>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="weight" className="text-sm font-medium">
                  Tiebreaker Weight: {weight}
                </Label>
                <Slider
                  id="weight"
                  min={0}
                  max={100}
                  step={1}
                  value={[weight]}
                  onValueChange={([v]) => setWeight(v)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Higher weight ranks this entry above others with the same score.
                </p>
              </div>
              <GutRatingForm
                gutRating={gutRating}
                notes={notes}
                onGutRatingChange={setGutRating}
                onNotesChange={setNotes}
              />
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Add New Rating</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/entries"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Find a movie or TV show to rate</CardDescription>
        </CardHeader>
        <CardContent>
          <TMDSearch onSelect={handleSelect} />
        </CardContent>
      </Card>
    </div>
  )
}
