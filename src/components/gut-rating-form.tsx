"use client"

import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Info } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

interface GutRatingFormProps {
  gutRating: number
  notes: string
  onGutRatingChange: (value: number) => void
  onNotesChange: (value: string) => void
}

const GUT_RATING_INFO =
  "Trust your gut — or don't... but here is where you can decide what quick rating you would give this show or movie. This is a way to express your overall impression of an entry. Try not to be rash... but trust your intuition. Hint: There is always the detailed rating."

export function GutRatingForm({ gutRating, notes, onGutRatingChange, onNotesChange }: GutRatingFormProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="flex items-center gap-1.5">
            Gut Rating: {gutRating}/100
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex cursor-help items-center text-muted-foreground hover:text-foreground"
                  aria-label="About Gut Rating"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{GUT_RATING_INFO}</p>
              </TooltipContent>
            </Tooltip>
          </Label>
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
    </TooltipProvider>
  )
}
