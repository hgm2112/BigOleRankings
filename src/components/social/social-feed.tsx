"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScoreChip } from "@/components/score-chip"
import { PosterLightbox } from "@/components/poster-lightbox"
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

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay === 1) return "Yesterday"
  if (diffDay < 7) return `${diffDay}d ago`

  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
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
  if (event.type === "watch") {
    if (
      (event.watch_event_type !== "finished" && event.watch_event_type !== "dnf") ||
      event.season_number == null ||
      event.season_rating == null
    ) {
      return null
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ScoreChip value={event.season_rating} max={10} />
        <span className="tabular-nums">/10</span>
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

function eventVerbParts(event: FeedEvent): { action: string; suffix: string } {
  if (event.type === "gut") return { action: "gut-rated", suffix: "" }
  if (event.type === "detailed") return { action: "detailed-rated", suffix: "" }
  if (event.type === "season") {
    if (event.dnf) return { action: `DNF'd S${event.season_number} of`, suffix: "" }
    return { action: `rated S${event.season_number} of`, suffix: "" }
  }
  // watch
  const seasonSuffix =
    event.media.media_type === "tv" && event.season_number != null
      ? ` — Season ${event.season_number} of`
      : ""
  switch (event.watch_event_type) {
    case "started":
      return event.media.media_type === "tv" && event.season_number != null
        ? { action: "started watching", suffix: seasonSuffix }
        : { action: "started watching", suffix: "" }
    case "finished":
      return event.media.media_type === "tv" && event.season_number != null
        ? { action: "finished", suffix: seasonSuffix }
        : { action: "finished watching", suffix: "" }
    case "stopped":
      return event.media.media_type === "tv" && event.season_number != null
        ? { action: "paused watching", suffix: seasonSuffix }
        : { action: "paused watching", suffix: "" }
    case "dnf":
      return event.media.media_type === "tv" && event.season_number != null
        ? { action: "DNF'd", suffix: seasonSuffix }
        : { action: "DNF'd", suffix: "" }
    default:
      return { action: "is watching", suffix: "" }
  }
}

function eventVerb(event: FeedEvent): string {
  const { action, suffix } = eventVerbParts(event)
  return `${action}${suffix}`
}

function eventMobileAction(event: FeedEvent): string {
  if (event.type === "gut") return "gut-rated"
  if (event.type === "detailed") return "detailed-rated"
  if (event.type === "season") return event.dnf ? "DNF'd" : "rated"
  switch (event.watch_event_type) {
    case "started":
      return "started watching"
    case "finished":
      return "finished"
    case "stopped":
      return "paused watching"
    case "dnf":
      return "DNF'd"
    default:
      return "is watching"
  }
}

function eventMobileMeta(event: FeedEvent): string | null {
  const parts: string[] = []
  if (event.media.media_type === "tv" && event.season_number != null) {
    parts.push(`Season ${event.season_number}`)
  }

  let score: string | null = null
  if (event.type === "gut") {
    score = `${event.gut_rating}/100`
  } else if (event.type === "detailed") {
    score = `${event.detailed_total}/100`
  } else if (event.type === "watch") {
    if (
      (event.watch_event_type === "finished" || event.watch_event_type === "dnf") &&
      event.season_number != null &&
      event.season_rating != null
    ) {
      score = `${event.season_rating}/10`
    }
  } else if (event.type === "season") {
    if (!event.dnf && event.season_rating != null) {
      score = `${event.season_rating}/10`
    }
  }

  if (score) parts.push(score)
  return parts.length > 0 ? parts.join(" · ") : null
}

function MobileEventMeta({ event }: { event: FeedEvent }) {
  const seasonLabel =
    event.media.media_type === "tv" && event.season_number != null ? `Season ${event.season_number}` : null

  let score: { value: number; max: number; suffix: string } | null = null
  if (event.type === "gut" && event.gut_rating != null) {
    score = { value: event.gut_rating, max: 100, suffix: "/100" }
  } else if (event.type === "detailed" && event.detailed_total != null) {
    score = { value: event.detailed_total, max: 100, suffix: "/100" }
  } else if (event.type === "watch") {
    if (
      (event.watch_event_type === "finished" || event.watch_event_type === "dnf") &&
      event.season_number != null &&
      event.season_rating != null
    ) {
      score = { value: event.season_rating, max: 10, suffix: "/10" }
    }
  } else if (event.type === "season") {
    if (!event.dnf && event.season_rating != null) {
      score = { value: event.season_rating, max: 10, suffix: "/10" }
    }
  }

  if (!seasonLabel && !score) return null

  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
      {seasonLabel && <span>{seasonLabel}</span>}
      {seasonLabel && score && <span>·</span>}
      {score && (
        <span className="inline-flex items-center gap-1">
          <ScoreChip value={score.value} max={score.max} />
          <span className="tabular-nums">{score.suffix}</span>
        </span>
      )}
    </p>
  )
}

function eventActionClass(event: FeedEvent, compact = false): string | undefined {
  const chip = compact
    ? "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset"
    : "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset"
  if (event.type === "gut") return `${chip} bg-teal-600 text-teal-50 ring-teal-300/30`
  if (event.type === "detailed") return `${chip} bg-violet-600 text-violet-50 ring-violet-300/30`
  if (event.type === "watch") {
    if (event.watch_event_type === "started") return `${chip} bg-sky-600 text-sky-50 ring-sky-300/30`
    if (event.watch_event_type === "finished") return `${chip} bg-[#8a5b00] text-[#ffc94d] ring-[#ffd27a]/40`
    if (event.watch_event_type === "stopped") return `${chip} bg-[#7a2e00] text-[#ff9a3d] ring-[#ffb066]/40`
    if (event.watch_event_type === "dnf") return `${chip} bg-[#6b0000] text-[#ff6b6b] ring-[#ff8a8a]/35`
  }
  if (event.type === "season") {
    if (event.dnf) return `${chip} bg-[#6b0000] text-[#ff6b6b] ring-[#ff8a8a]/35`
    return `${chip} bg-indigo-600 text-indigo-50 ring-indigo-300/30`
  }
  return undefined
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
  const isOwn = !!me && me.username === event.user.username
  const { action, suffix } = eventVerbParts(event)
  const actionClass = eventActionClass(event)
  const mobileAction = eventMobileAction(event)
  const mobileActionClass = eventActionClass(event, true)
  const mobileMeta = eventMobileMeta(event)
  const relativeTime = formatRelativeTime(event.at)
  const absoluteTime = new Date(event.at).toLocaleString()

  const poster = event.media.poster_path ? (
    <Image
      src={`https://image.tmdb.org/t/p/w154${event.media.poster_path}`}
      alt={event.media.title}
      fill
      sizes="(max-width: 640px) 64px, 40px"
      quality={90}
      className="object-cover"
    />
  ) : event.media.media_type === "tv" ? (
    <Tv className="h-4 w-4 text-muted-foreground" />
  ) : (
    <Film className="h-4 w-4 text-muted-foreground" />
  )

  return (
    <div className="relative rounded-md sm:rounded sm:p-2 sm:hover:bg-accent">
      {/* Mobile layout */}
      <div className="sm:hidden relative flex gap-3 p-3">
        <Link
          href={titleHref}
          aria-label={`${displayName} ${mobileAction} ${event.media.title}`}
          className="absolute inset-0 z-0 rounded-md"
        />
        {event.media.poster_path ? (
          <PosterLightbox
            posterPath={event.media.poster_path}
            alt={event.media.title}
            className="relative z-10 block w-16 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0"
          >
            {poster}
          </PosterLightbox>
        ) : (
          <div className="relative w-16 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0 z-0">
            <div className="w-full h-full flex items-center justify-center">{poster}</div>
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-1 relative z-0 min-h-24">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium truncate">{displayName}</span>
            {mobileActionClass && (
              <span className={cn("shrink-0 max-w-full truncate", mobileActionClass)}>{mobileAction}</span>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug line-clamp-2">{event.media.title}</p>
          <MobileEventMeta event={event} />
          <p className="text-xs text-muted-foreground" title={absoluteTime}>{relativeTime}</p>
        </div>
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 h-24">
          <div className="pointer-events-auto absolute bottom-0 right-0 flex items-end">
            {isOwn ? (
              event.like_count > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${event.like_count} ${event.like_count === 1 ? "person likes" : "people like"} this`}
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                      }}
                      className="relative z-10 h-11 w-11 inline-flex items-end justify-center pb-0 rounded-md text-amber-400 transition-colors hover:text-amber-300 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <Heart className="h-5 w-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" side="top" sideOffset={8} collisionPadding={12} className="z-50 w-60 p-2">
                    <p className="text-xs font-medium text-muted-foreground px-1 pb-1">Liked by</p>
                    {event.likers.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {event.likers.map((liker) => (
                          <Link
                            key={liker.username}
                            href={`/users/${liker.username}`}
                            onClick={(e) => e.stopPropagation()}
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
                    ) : (
                      <p className="text-sm text-muted-foreground px-1 py-1">Someone liked this.</p>
                    )}
                  </PopoverContent>
                </Popover>
              )
            ) : (
              <button
                type="button"
                aria-label={event.liked_by_me ? "Unlike this update" : "Like this update"}
                aria-pressed={event.liked_by_me}
                disabled={!me}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleLike(event)
                }}
                className="h-11 w-11 inline-flex items-end justify-center pb-0 rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Heart
                  className={cn(
                    "h-5 w-5 transition-colors",
                    event.liked_by_me && "fill-current text-red-500"
                  )}
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden sm:flex gap-3">
        {event.media.poster_path ? (
          <PosterLightbox
            posterPath={event.media.poster_path}
            alt={event.media.title}
            className="block w-10 h-[60px] rounded overflow-hidden bg-muted flex-shrink-0"
          >
            <div className="relative w-full h-full">
              <Image
                src={`https://image.tmdb.org/t/p/w154${event.media.poster_path}`}
                alt={event.media.title}
                fill
                sizes="40px"
                quality={90}
                className="object-cover"
              />
            </div>
          </PosterLightbox>
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
            <Link href={`/users/${event.user.username}`} className="font-medium hover:underline">
              {displayName}
            </Link>
            {actionClass ? (
              <>
                <span className={cn(actionClass)}>{action}</span>
                {suffix && <span className="text-muted-foreground">{suffix}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">{action}{suffix}</span>
            )}
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
              className={cn("h-4 w-4 transition-colors", event.liked_by_me && "fill-current text-red-500")}
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
      <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
        <CardTitle className="text-base sm:text-sm flex items-center gap-2 font-bold sm:font-semibold">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
        <CardDescription className="text-sm">Ratings and watching activity from you and your friends</CardDescription>
      </CardHeader>
      <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2 py-4 sm:px-0 sm:py-0">
            No recent activity yet.
          </p>
        ) : (
          <div className="flex flex-col sm:space-y-1 sm:block divide-y divide-border/60 sm:divide-y-0">
            {events.map((event) => (
              <FeedRow key={event.key} event={event} me={me} onToggleLike={toggleLike} />
            ))}
          </div>
        )}
        {error && <p className="text-sm text-destructive mt-2 px-2 sm:px-0">{error}</p>}
        {cursor && (
          <div className="px-2 pb-2 sm:px-0 sm:pb-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
