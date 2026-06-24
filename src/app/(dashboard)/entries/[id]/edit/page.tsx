"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { GutRatingForm } from "@/components/gut-rating-form"
import { DetailedRatingForm } from "@/components/detailed-rating-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Trash2 } from "lucide-react"
import Link from "next/link"
import { use } from "react"
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

export default function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [entry, setEntry] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [gutRating, setGutRating] = useState(50)
  const [notes, setNotes] = useState("")
  const [weight, setWeight] = useState(0)
  const [enjoyment, setEnjoyment] = useState(30)
  const [impact, setImpact] = useState(10)
  const [recommend, setRecommend] = useState(5)
  const [watchAgain, setWatchAgain] = useState(5)

  useEffect(() => {
    const fetchEntry = async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("id", id)
        .single()

      if (error || !data) {
        router.push("/entries")
        return
      }
      setEntry(data)
      setGutRating(data.gut_rating ?? 50)
      setNotes(data.notes ?? "")
      setWeight(data.weight ?? 0)
      setEnjoyment(data.detailed_enjoyment ?? 30)
      setImpact(data.detailed_impact ?? 10)
      setRecommend(data.detailed_recommend ?? 5)
      setWatchAgain(data.detailed_watch_again ?? 5)
      setLoading(false)
    }
    fetchEntry()
  }, [id, supabase, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from("entries")
      .update({
        gut_rating: gutRating,
        notes,
        weight,
        detailed_enjoyment: enjoyment,
        detailed_impact: impact,
        detailed_recommend: recommend,
        detailed_watch_again: watchAgain,
        detailed_rated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    router.push(`/entries/${id}`)
    router.refresh()
  }

  const handleDelete = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from("entries")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (!error) {
      router.push("/entries")
      router.refresh()
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/entries/${id}`}><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit {entry.title}</CardTitle>
          <CardDescription>Update your ratings and notes</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <GutRatingForm
              gutRating={gutRating}
              notes={notes}
              onGutRatingChange={setGutRating}
              onNotesChange={setNotes}
            />

            <Separator />
            <h3 className="font-semibold">Detailed Rating</h3>
            <DetailedRatingForm
              enjoyment={enjoyment}
              impact={impact}
              recommend={recommend}
              watchAgain={watchAgain}
              onEnjoymentChange={setEnjoyment}
              onImpactChange={setImpact}
              onRecommendChange={setRecommend}
              onWatchAgainChange={setWatchAgain}
              gutRating={gutRating}
            />

            <Separator />
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

            <div className="flex items-center justify-between gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />Delete
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Entry</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete &ldquo;{entry.title}&rdquo;? This cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
