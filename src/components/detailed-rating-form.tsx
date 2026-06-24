"use client"

import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

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
        <Label>Enjoyment: {enjoyment}/60</Label>
        <Slider value={[enjoyment]} onValueChange={([v]) => onEnjoymentChange(v)} min={0} max={60} step={1} />
      </div>

      <div className="space-y-3">
        <Label>Impact: {impact}/20</Label>
        <Slider value={[impact]} onValueChange={([v]) => onImpactChange(v)} min={0} max={20} step={1} />
      </div>

      <div className="space-y-3">
        <Label>Recommend: {recommend}/10</Label>
        <Slider value={[recommend]} onValueChange={([v]) => onRecommendChange(v)} min={0} max={10} step={1} />
      </div>

      <div className="space-y-3">
        <Label>Watch Again: {watchAgain}/10</Label>
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
