"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { EntryCard } from "@/components/entry-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Plus } from "lucide-react"

interface SupabaseEntry {
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

interface Props {
  entries: SupabaseEntry[]
  userId: string
}

export function EntriesClient({ entries, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [currentEntries, setCurrentEntries] = useState(entries)

  const movies = currentEntries.filter((e) => e.media_type === "movie")
  const tvShows = currentEntries.filter((e) => e.media_type === "tv")

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("entries").delete().eq("id", id).eq("user_id", userId)
    if (!error) {
      setCurrentEntries((prev) => prev.filter((e) => e.id !== id))
      router.refresh()
    }
  }

  if (currentEntries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Ratings</h1>
          <Button asChild><Link href="/entries/new"><Plus className="h-4 w-4 mr-1" />Add Entry</Link></Button>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No entries yet. Start by rating a movie or TV show!</p>
          <Button asChild className="mt-4"><Link href="/entries/new">Add Your First Rating</Link></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Ratings ({currentEntries.length})</h1>
        <Button asChild><Link href="/entries/new"><Plus className="h-4 w-4 mr-1" />Add Entry</Link></Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({currentEntries.length})</TabsTrigger>
          <TabsTrigger value="movies">Movies ({movies.length})</TabsTrigger>
          <TabsTrigger value="tv">TV Shows ({tvShows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-3">
          {currentEntries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </TabsContent>
        <TabsContent value="movies" className="space-y-3">
          {movies.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </TabsContent>
        <TabsContent value="tv" className="space-y-3">
          {tvShows.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
