"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { EntryCard } from "@/components/entry-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  created_at: string
}

interface Props {
  entries: SupabaseEntry[]
  userId: string
}

export function EntriesClient({ entries, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [currentEntries, setCurrentEntries] = useState(entries)
  const [sortField, setSortField] = useState("recent")
  const [sortDir, setSortDir] = useState("desc")

  const showOrder = !["recent", "name"].includes(sortField)

  const sorted = useMemo(() => {
    const list = [...currentEntries]
    const dir = sortDir === "desc" ? -1 : 1
    const detailedTotal = (e: SupabaseEntry) =>
      e.detailed_enjoyment != null
        ? e.detailed_enjoyment! + e.detailed_impact! + e.detailed_recommend! + e.detailed_watch_again!
        : null
    const absDiff = (e: SupabaseEntry) => {
      const dt = detailedTotal(e)
      return dt != null && e.gut_rating != null ? Math.abs(dt - e.gut_rating) : null
    }
    switch (sortField) {
      case "name":
        list.sort((a, b) => a.title.localeCompare(b.title))
        break
      case "gut":
        list.sort((a, b) => dir * ((a.gut_rating ?? -1) - (b.gut_rating ?? -1)))
        break
      case "detailed":
        list.sort((a, b) => dir * ((detailedTotal(a) ?? -1) - (detailedTotal(b) ?? -1)))
        break
      case "diff":
        list.sort((a, b) => dir * ((absDiff(a) ?? -999) - (absDiff(b) ?? -999)))
        break
      case "year":
        list.sort((a, b) => dir * ((a.year ?? -1) - (b.year ?? -1)))
        break
      case "watch_again":
        list.sort((a, b) => dir * ((a.detailed_watch_again ?? -1) - (b.detailed_watch_again ?? -1)))
        break
      default:
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return list
  }, [currentEntries, sortField, sortDir])

  const movies = sorted.filter((e) => e.media_type === "movie")
  const tvShows = sorted.filter((e) => e.media_type === "tv")
  const misc = sorted.filter((e) => e.media_type === "misc")

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
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All ({currentEntries.length})</TabsTrigger>
            <TabsTrigger value="movies">Movies ({movies.length})</TabsTrigger>
            <TabsTrigger value="tv">TV Shows ({tvShows.length})</TabsTrigger>
            <TabsTrigger value="misc">Misc ({misc.length})</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Select value={sortField} onValueChange={setSortField}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="gut">Gut Rating</SelectItem>
                <SelectItem value="detailed">Detailed Rating</SelectItem>
                <SelectItem value="diff">Gut vs Detail</SelectItem>
                <SelectItem value="watch_again">Watch Again</SelectItem>
                <SelectItem value="year">Year</SelectItem>
              </SelectContent>
            </Select>
            {showOrder && (
              <Select value={sortDir} onValueChange={setSortDir}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortField === "year" ? (
                    <>
                      <SelectItem value="desc">Newest</SelectItem>
                      <SelectItem value="asc">Oldest</SelectItem>
                    </>
                  ) : sortField === "diff" ? (
                    <>
                      <SelectItem value="desc">Biggest Gap</SelectItem>
                      <SelectItem value="asc">Smallest Gap</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="desc">High → Low</SelectItem>
                      <SelectItem value="asc">Low → High</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <TabsContent value="all" className="space-y-3">
          {sorted.map((entry) => (
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
        <TabsContent value="misc" className="space-y-3">
          {misc.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
