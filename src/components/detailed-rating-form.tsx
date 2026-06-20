"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

interface DetailedRatingFormProps {
  initialValues?: {
    enjoyment: number
    impact: number
    recommend: number
    watch_again: number
  }
  gutRating?: number
  onSubmit: (data: {
    detailed_enjoyment: number
    detailed_impact: number
    detailed_recommend: number
    detailed_watch_again: number
  }) => void
  loading?: boolean
}

export function DetailedRatingForm({ initialValues, gutRating, onSubmit, loading }: DetailedRatingFormProps) {
  const [enjoyment, setEnjoyment] = useState(initialValues?.enjoyment ?? 30)
  const [impact, setImpact] = useState(initialValues?.impact ?? 10)
  const [recommend, setRecommend] = useState(initialValues?.recommend ?? 5)
  const [watchAgain, setWatchAgain] = useState(initialValues?.watch_again ?? 5)

  const total = enjoyment + impact + recommend + watchAgain
  const diff = gutRating !== undefined ? total - gutRating : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      detailed_enjoyment: enjoyment,
      detailed_impact: impact,
      detailed_recommend: recommend,
      detailed_watch_again: watchAgain,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label>Enjoyment: {enjoyment}/60</Label>
        <Slider value={[enjoyment]} onValueChange={([v]) => setEnjoyment(v)} min={0} max={60} step={1} />
      </div>

      <div className="space-y-3">
        <Label>Impact: {impact}/20</Label>
        <Slider value={[impact]} onValueChange={([v]) => setImpact(v)} min={0} max={20} step={1} />
      </div>

      <div className="space-y-3">
        <Label>Recommend: {recommend}/10</Label>
        <Slider value={[recommend]} onValueChange={([v]) => setRecommend(v)} min={0} max={10} step={1} />
      </div>

      <div className="space-y-3">
        <Label>Watch Again: {watchAgain}/10</Label>
        <Slider value={[watchAgain]} onValueChange={([v]) => setWatchAgain(v)} min={0} max={10} step={1} />
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

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save Detailed Rating"}
      </Button>
    </form>
  )
}
