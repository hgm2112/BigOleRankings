"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
}

export default function NewEntryPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<TMDBResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = (item: TMDBResult) => {
    setSelected(item)
  }

  const handleSubmit = async (data: { gut_rating: number; notes: string }) => {
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
        gut_rating: data.gut_rating,
        notes: data.notes,
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
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GutRatingForm onSubmit={handleSubmit} loading={loading} />
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
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
