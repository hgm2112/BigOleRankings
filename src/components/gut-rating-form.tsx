"use client"

import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface GutRatingFormProps {
  gutRating: number
  notes: string
  onGutRatingChange: (value: number) => void
  onNotesChange: (value: string) => void
}

export function GutRatingForm({ gutRating, notes, onGutRatingChange, onNotesChange }: GutRatingFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Gut Rating: {gutRating}/100</Label>
        <Slider
          value={[gutRating]}
          onValueChange={([v]) => onGutRatingChange(v)}
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
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  )
}
