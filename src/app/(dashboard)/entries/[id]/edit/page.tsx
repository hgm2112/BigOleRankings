"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { GutRatingForm } from "@/components/gut-rating-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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

  const handleSubmit = async (data: { gut_rating: number; notes: string }) => {
    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from("entries")
      .update({
        gut_rating: data.gut_rating,
        notes: data.notes,
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
          <CardDescription>Update your gut rating and notes</CardDescription>
        </CardHeader>
        <CardContent>
          <GutRatingForm
            initialGut={entry.gut_rating ?? 50}
            initialNotes={entry.notes ?? ""}
            onSubmit={handleSubmit}
            loading={saving}
          />
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
