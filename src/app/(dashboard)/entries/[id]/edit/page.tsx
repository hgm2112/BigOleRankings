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
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { use } from "react"

export default function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [entry, setEntry] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [weight, setWeight] = useState(0)
  const [detailedInitial, setDetailedInitial] = useState<{
    enjoyment: number; impact: number; recommend: number; watch_again: number
  } | undefined>(undefined)

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
      setWeight(data.weight ?? 0)
      if (data.detailed_enjoyment != null) {
        setDetailedInitial({
          enjoyment: data.detailed_enjoyment,
          impact: data.detailed_impact,
          recommend: data.detailed_recommend,
          watch_again: data.detailed_watch_again,
        })
      }
      setLoading(false)
    }
    fetchEntry()
  }, [id, supabase, router])

  const handleSubmit = async (data: { gut_rating: number; notes: string }) => {
    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from("entries")
      .update({
        gut_rating: data.gut_rating,
        notes: data.notes,
        weight,
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

  const handleDetailedSubmit = async (data: {
    detailed_enjoyment: number
    detailed_impact: number
    detailed_recommend: number
    detailed_watch_again: number
  }) => {
    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from("entries")
      .update({
        ...data,
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
          <div className="mb-6">
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
            initialGut={entry.gut_rating ?? 50}
            initialNotes={entry.notes ?? ""}
            onSubmit={handleSubmit}
            loading={saving}
          />

          <Separator className="my-6" />
          <h3 className="font-semibold mb-4">Detailed Rating</h3>
          <DetailedRatingForm
            initialValues={detailedInitial}
            gutRating={entry.gut_rating}
            onSubmit={handleDetailedSubmit}
            loading={saving}
          />
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
