"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface EditorSeason {
  season_number: number
  name: string | null
  air_year: number | null
  episode_count: number | null
}

export interface SeasonRatingValue {
  season_number: number
  rating: number | null
  dnf: boolean
}

export function SeasonRatingsEditor({
  seasons,
  ratings,
  onChange,
}: {
  seasons: EditorSeason[]
  ratings: SeasonRatingValue[]
  onChange: (seasonNumber: number, rating: number | null, dnf: boolean) => void
}) {
  if (seasons.length === 0) {
    return <p className="text-sm text-muted-foreground">No season data yet. Check back after the next refresh.</p>
  }

  const ratingMap = new Map(ratings.map((r) => [r.season_number, r]))

  return (
    <div className="space-y-3">
      {seasons.map((s) => {
        const sr = ratingMap.get(s.season_number)
        const rating = sr?.rating ?? null
        const dnf = sr?.dnf ?? false
        return (
          <div key={s.season_number} className="flex items-center justify-between gap-3 flex-wrap border-b border-border/50 pb-2 last:border-0 last:pb-0">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">Season {s.season_number}</span>
              {s.name && s.name !== `Season ${s.season_number}` && (
                <span className="text-sm text-muted-foreground">({s.name})</span>
              )}
              {s.air_year != null && <span className="text-xs text-muted-foreground">{s.air_year}</span>}
              {s.episode_count != null && <span className="text-xs text-muted-foreground">· {s.episode_count} episodes</span>}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dnf}
                  onChange={(e) => onChange(s.season_number, rating, e.target.checked)}
                />
                DNF
              </label>
              <Select
                value={rating != null ? String(rating) : ""}
                onValueChange={(v) => onChange(s.season_number, v === "clear" ? null : Number(v), dnf)}
              >
                <SelectTrigger className="w-[90px] h-8">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}/10</SelectItem>
                  ))}
                  <SelectItem value="clear">Clear</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )
      })}
    </div>
  )
}
