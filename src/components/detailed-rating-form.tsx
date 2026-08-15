"use client"

import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Info } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

interface DetailedRatingFormProps {
  enjoyment: number
  impact: number
  recommend: number
  watchAgain: number
  onEnjoymentChange: (value: number) => void
  onImpactChange: (value: number) => void
  onRecommendChange: (value: number) => void
  onWatchAgainChange: (value: number) => void
  gutRating?: number
}

const FIELD_INFO: Record<string, string> = {
  enjoyment:
    "Was it engaging? Did it grip you? Were you tempted to binge the whole show? Did your bedtime change because you had to stay up to see it? This, ladies and gentlemen, is Enjoyment. Enjoyment is weighted the most significantly of all the Detailed Ratings categories because it is the most likely reason for the show/movie to exist in the first place. Enjoyment is worth a total of 60% of the overall grade you will give an entry.",
  impact:
    "Ahhh the most philosophical thing to score, in other words the Impact. This is a way to say, \"I am still laughing at x. I'm still crying because of character y. I am still so scared of the dark I started going to church again.\" This is about how much this show/movie sat with you after all the watching was done or even, how much your daily life is encompassed by that entry. Impact is worth 20% of the total grade an entry can receive.",
  recommend:
    "Tell your friends! I mean, if it's good. Heck tell them for any reason, but do you want this title associated with you? Are you willing to put your reputation on the line? Recommend is worth 10% of the total grade an entry can receive.",
  watchAgain:
    "Take me back, I miss your face. But for real, how much do you want to be transported back to that place and those characters? How great would it be to go over the information again knowing everything you know now? Maybe it would suck... or maybe you're hate watching with a friend. Watch Again is worth 10% of the total grade an entry can receive.",
}

function FieldLabel({ field, label }: { field: string; label: string }) {
  return (
    <Label className="flex items-center gap-1.5">
      {label}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center text-muted-foreground hover:text-foreground"
            aria-label={`About ${label.split(":")[0]}`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 max-w-[calc(100vw-2rem)]">
          <p className="text-sm">{FIELD_INFO[field]}</p>
        </PopoverContent>
      </Popover>
    </Label>
  )
}

export function DetailedRatingForm({
  enjoyment,
  impact,
  recommend,
  watchAgain,
  onEnjoymentChange,
  onImpactChange,
  onRecommendChange,
  onWatchAgainChange,
  gutRating,
}: DetailedRatingFormProps) {
  const total = enjoyment + impact + recommend + watchAgain
  const diff = gutRating !== undefined ? total - gutRating : null

  return (
    <div className="space-y-6">
        <div className="space-y-3">
          <FieldLabel field="enjoyment" label={`Enjoyment: ${enjoyment}/60`} />
          <Slider value={[enjoyment]} onValueChange={([v]) => onEnjoymentChange(v)} min={0} max={60} step={1} />
        </div>

        <div className="space-y-3">
          <FieldLabel field="impact" label={`Impact: ${impact}/20`} />
          <Slider value={[impact]} onValueChange={([v]) => onImpactChange(v)} min={0} max={20} step={1} />
        </div>

        <div className="space-y-3">
          <FieldLabel field="recommend" label={`Recommend: ${recommend}/10`} />
          <Slider value={[recommend]} onValueChange={([v]) => onRecommendChange(v)} min={0} max={10} step={1} />
        </div>

        <div className="space-y-3">
          <FieldLabel field="watchAgain" label={`Watch Again: ${watchAgain}/10`} />
          <Slider value={[watchAgain]} onValueChange={([v]) => onWatchAgainChange(v)} min={0} max={10} step={1} />
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">{total}/100</p>
              <p className="text-sm text-muted-foreground">Detailed Total</p>
              {diff !== null && (
                <p className={`text-sm font-medium ${diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {diff > 0 ? "+" : ""}{diff} from gut rating ({gutRating})
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
  )
}
