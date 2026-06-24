"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { DetailedRatingForm } from "@/components/detailed-rating-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { use } from "react"

export default function DetailedRatingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [entry, setEntry] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setLoading(false)
    }
    fetchEntry()
  }, [id, supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from("entries")
      .update({
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

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>
  }

  if (entry.detailed_enjoyment !== null) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/entries/${id}`}><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Already Rated</CardTitle>
            <CardDescription>You've already added a detailed rating for {entry.title}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href={`/entries/${id}/edit`}>Edit Entry</Link></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/entries/${id}`}><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Rating</CardTitle>
          <CardDescription>
            Rate {entry.title} in detail. Gut rating: {entry.gut_rating}/100
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <DetailedRatingForm
              enjoyment={enjoyment}
              impact={impact}
              recommend={recommend}
              watchAgain={watchAgain}
              onEnjoymentChange={setEnjoyment}
              onImpactChange={setImpact}
              onRecommendChange={setRecommend}
              onWatchAgainChange={setWatchAgain}
              gutRating={entry.gut_rating}
            />
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Detailed Rating"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
