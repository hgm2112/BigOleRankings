import { Check } from "lucide-react"

export function AuthBlurb() {
  return (
    <div>
      <h1 className="text-3xl font-bold">BigOleRankings</h1>
      <p className="mt-2 text-lg text-muted-foreground">Rate by gut. Rank with friends.</p>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Keep a running score of everything you watch. Give each movie and TV show a quick 1–100 gut rating,
        then break it down by enjoyment, impact, whether you&apos;d recommend it, and if you&apos;d watch it again.
        Track individual seasons of your favorite shows, jot down notes, and see how your taste stacks up
        head-to-head against your friends.
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          Gut rating + detailed breakdown (enjoyment / impact / recommend / watch again)
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          Per-season tracking and notes for TV shows and Movies
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          Compare your rankings against friends
        </li>
      </ul>
    </div>
  )
}
