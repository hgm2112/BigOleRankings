"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Search, Film, Tv } from "lucide-react"

interface TMDBResult {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: string
  media_type: string
  overview: string
  runtime?: number | null
}

interface TMDBSearchProps {
  onSelect: (item: TMDBResult) => void
}

export function TMDSearch({ onSelect }: TMDBSearchProps) {
  const [query, setQuery] = useState("")
  const [type, setType] = useState("movie")
  const [results, setResults] = useState<TMDBResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)

    try {
      const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(query)}&type=${type}`)
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const posterUrl = (path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w185${path}` : null

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] gap-x-2 gap-y-2 items-center">
        <Label htmlFor="search" className="col-span-2 sm:col-span-1 sm:col-start-1 sm:row-start-1">Search</Label>
        <Input
          id="search"
          className="col-span-2 sm:col-span-1 sm:col-start-1 sm:row-start-2"
          placeholder="Search for a movie or TV show..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
      </form>

      {loading && <p className="text-sm text-muted-foreground">Searching...</p>}

      {!loading && searched && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No results found.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.map((item) => {
            const poster = posterUrl(item.poster_path)
            return (
              <Card
                key={item.tmdb_id}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => onSelect(item)}
              >
                {poster ? (
                  <Image src={poster} alt={item.title} width={46} height={69} quality={90} className="rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-[46px] h-[69px] rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {item.media_type === "tv" ? <Tv className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.year}</span>
                    <span>{item.media_type === "tv" ? "TV Show" : "Movie"}</span>
                  </div>
                  {item.overview && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.overview}</p>
                  )}
                </div>
                <Button size="sm" className="ml-auto flex-shrink-0" onClick={(e) => { e.stopPropagation(); onSelect(item) }}>
                  Select
                </Button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
