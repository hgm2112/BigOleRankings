"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScoreChip } from "@/components/score-chip"
import { createClient } from "@/lib/supabase/client"
import { FeedEvent, FEED_DEFAULT_LIMIT } from "@/lib/social-feed"
import { cn } from "@/lib/utils"
import { Activity, Film, Heart, Loader2, Tv } from "lucide-react"

interface SocialFeedProps {
  initialEvents: FeedEvent[]
  initialCursor: string | null
}

interface Me {
  id: string
  username: string
  display_name: string | null
}

function EventScore({ event }: { event: FeedEvent }) {
  if (event.type === "gut") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ScoreChip value={event.gut_rating} />
        <span className="tabular-nums">/100</span>
      </span>
    )
  }
  if (event.type === "detailed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ScoreChip value={event.detailed_total} />
        <span className="tabular-nums">/100</span>
      </span>
    )
  }
  if (event.dnf) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <ScoreChip value={event.season_rating} max={10} />
      <span className="tabular-nums">/10</span>
    </span>
  )
}

function eventVerb(event: FeedEvent): string {
  if (event.type === "gut") return "rated"
  if (event.type === "detailed") return "detailed-rated"
  if (event.dnf) return `DNF'd S${event.season_number} of`
  return `rated S${event.season_number} of`
}

function FeedRow({
  event,
  me,
  onToggleLike,
}: {
  event: FeedEvent
  me: Me | null
  onToggleLike: (event: FeedEvent) => void
}) {
  const titleHref = event.entryId ? `/entries/${event.entryId}` : `/users/${event.user.username}`
  const displayName = event.user.display_name || event.user.username

  return (
    <div className="flex gap-3 p-2 rounded hover:bg-accent">
      {event.media.poster_path ? (
        <div className="relative w-10 h-[60px] rounded overflow-hidden bg-muted flex-shrink-0">
          <Image
            src={`https://image.tmdb.org/t/p/w154${event.media.poster_path}`}
            alt={event.media.title}
            fill
            sizes="40px"
            quality={90}
            className="object-cover"
          />
        </div>
      ) : (
        <div className="w-10 h-[60px] rounded bg-muted flex items-center justify-center flex-shrink-0">
          {event.media.media_type === "tv" ? (
            <Tv className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Film className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm flex-wrap">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <Link
            href={`/users/${event.user.username}`}
            className="font-medium hover:underline"
          >
            {displayName}
          </Link>
          <span className="text-muted-foreground">{eventVerb(event)}</span>
          <Link href={titleHref} className="font-medium hover:underline line-clamp-1">
            {event.media.title}
          </Link>
          <EventScore event={event} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          {event.media.media_type === "tv" ? (
            <Tv className="h-3 w-3" aria-label="TV show" />
          ) : (
            <Film className="h-3 w-3" aria-label="Movie" />
          )}
          <span>
            {event.media.year ? `${event.media.year} · ` : ""}
            {new Date(event.at).toLocaleString()}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-1 self-center flex-shrink-0">
        <button
          type="button"
          aria-label={event.liked_by_me ? "Unlike this update" : "Like this update"}
          aria-pressed={event.liked_by_me}
          disabled={!me}
          onClick={() => onToggleLike(event)}
          className="p-1.5 rounded-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              event.liked_by_me && "fill-current text-red-500"
            )}
          />
        </button>
        {event.like_count > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${event.like_count} likes`}
                className="text-xs text-muted-foreground tabular-nums hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded px-1"
              >
                {event.like_count}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2">
              <p className="text-xs font-medium text-muted-foreground px-1 pb-1">Liked by</p>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {event.likers.map((liker) => (
                  <Link
                    key={liker.username}
                    href={`/users/${liker.username}`}
                    className="flex items-center gap-2 rounded p-1 text-sm hover:bg-accent"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {(liker.display_name || liker.username).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{liker.display_name || liker.username}</span>
                  </Link>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}

export function SocialFeed({ initialEvents, initialCursor }: SocialFeedProps) {
  const supabase = createClient()
  const [me, setMe] = useState<Me | null>(null)
  const [events, setEvents] = useState<FeedEvent[]>(initialEvents)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadMe = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled || !profile) return
      setMe({ id: user.id, username: profile.username, display_name: profile.display_name ?? null })
    }
    loadMe()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const loadMore = async () => {
    if (!cursor || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/social/feed?before=${encodeURIComponent(cursor)}&limit=${FEED_DEFAULT_LIMIT}`
      )
      if (!res.ok) throw new Error(`Failed to load activity (${res.status})`)
      const data: { events: FeedEvent[]; nextCursor: string | null } = await res.json()
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.key))
        return [...prev, ...data.events.filter((e) => !seen.has(e.key))]
      })
      setCursor(data.nextCursor)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity")
    } finally {
      setLoading(false)
    }
  }

  const toggleLike = async (event: FeedEvent) => {
    if (!me) return
    const hadLiked = event.liked_by_me
    const snapshot = events

    setEvents((prev) =>
      prev.map((e) => {
        if (e.key !== event.key) return e
        const alreadyInList = e.likers.some((l) => l.username === me.username)
        const likers = hadLiked
          ? e.likers.filter((l) => l.username !== me.username)
          : alreadyInList
            ? e.likers
            : [...e.likers, { username: me.username, display_name: me.display_name }]
        return {
          ...e,
          liked_by_me: !hadLiked,
          like_count: Math.max(0, e.like_count + (hadLiked ? -1 : 1)),
          likers,
        }
      })
    )

    try {
      if (hadLiked) {
        const { error: delErr } = await supabase
          .from("feed_likes")
          .delete()
          .eq("user_id", me.id)
          .eq("event_key", event.key)
        if (delErr) throw new Error(delErr.message)
      } else {
        const { error: insErr } = await supabase
          .from("feed_likes")
          .upsert(
            { user_id: me.id, event_key: event.key },
            { onConflict: "user_id,event_key", ignoreDuplicates: true }
          )
        if (insErr) throw new Error(insErr.message)
      }
    } catch (err) {
      setEvents(snapshot)
      setError(err instanceof Error ? err.message : "Failed to update like")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
        <CardDescription>What you and your friends have been watching</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity yet — rate something or follow some friends.
          </p>
        ) : (
          <div className="space-y-1">
            {events.map((event) => (
              <FeedRow key={event.key} event={event} me={me} onToggleLike={toggleLike} />
            ))}
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive mt-2">{error}</p>
        )}
        {cursor && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
