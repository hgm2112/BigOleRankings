import { Check } from "lucide-react"

export function AuthBlurb({ variant = "default" }: { variant?: "default" | "login" | "register" }) {
  if (variant === "register") {
    return (
      <div>
        <h1 className="text-3xl font-bold">BigOleRankings</h1>
        <p className="mt-2 text-lg text-muted-foreground">Hey there new bestie!</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          You here to rate some tv shows and movies? BigOleRankings is a site for you to catalog your favorites and
          remember to never watch certain things ever again!
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          You&apos;ll be able to give gut reactions and detailed analysis for each entry based on a unique scoring
          system, track individual seasons of your favorite shows, jot down notes, and see how your taste stacks up
          against your friends.
        </p>
        <p className="mt-4 text-sm font-semibold text-foreground">But you gotta sign up first!</p>
      </div>
    )
  }

  if (variant === "login") {
    return (
      <div>
        <h1 className="text-3xl font-bold">BigOleRankings</h1>
        <p className="mt-2 text-lg text-muted-foreground">Get in here you old so and so!</p>
      </div>
    )
  }

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
