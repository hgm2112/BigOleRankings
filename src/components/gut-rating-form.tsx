"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface GutRatingFormProps {
  initialGut?: number
  initialNotes?: string
  onSubmit: (data: { gut_rating: number; notes: string }) => void
  loading?: boolean
}

export function GutRatingForm({ initialGut = 50, initialNotes = "", onSubmit, loading }: GutRatingFormProps) {
  const [gutRating, setGutRating] = useState(initialGut)
  const [notes, setNotes] = useState(initialNotes)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ gut_rating: gutRating, notes })
      }}
      className="space-y-6"
    >
      <div className="space-y-3">
        <Label>Gut Rating: {gutRating}/100</Label>
        <Slider
          value={[gutRating]}
          onValueChange={([v]) => setGutRating(v)}
          min={1}
          max={100}
          step={1}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Your initial thoughts..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save Rating"}
      </Button>
    </form>
  )
}
