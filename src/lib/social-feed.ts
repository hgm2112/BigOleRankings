// Shared fetcher for the /social activity feed. Events are derived from
// existing rating timestamps — no activity table. Used by the server page
// (initial render) and /api/social/feed (Load more), so both stay in sync.

import type { SupabaseClient } from "@supabase/supabase-js"

export interface FeedUser {
  id: string
  username: string
  display_name: string | null
}

export interface FeedMedia {
  title: string
  media_type: string
  year: number | null
  poster_path: string | null
  tmdb_id: number
}

export interface FeedLiker {
  username: string
  display_name: string | null
}

export interface FeedEvent {
  key: string
  type: "gut" | "detailed" | "season"
  at: string
  user: FeedUser
  media: FeedMedia
  entryId: string | null
  gut_rating?: number
  detailed_total?: number
  season_number?: number
  season_rating?: number
  dnf?: boolean
  like_count: number
  liked_by_me: boolean
  likers: FeedLiker[]
}

export interface FeedPage {
  events: FeedEvent[]
  nextCursor: string | null
}

export const FEED_DEFAULT_LIMIT = 30
export const FEED_MAX_LIMIT = 30

interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
}

interface RatingEventRow {
  id: string
  user_id: string
  media_id: string
  gut_rating: number | null
  gut_rated_at: string | null
  detailed_enjoyment: number | null
  detailed_impact: number | null
  detailed_recommend: number | null
  detailed_watch_again: number | null
  detailed_rated_at: string | null
  media: {
    title: string
    media_type: string
    year: number | null
    poster_path: string | null
    tmdb_id: number
  } | null
}

interface SeasonEventRow {
  user_id: string
  media_id: string
  season_number: number
  rating: number | null
  dnf: boolean
  updated_at: string
  media: {
    title: string
    media_type: string
    year: number | null
    poster_path: string | null
    tmdb_id: number
  } | null
}

interface LikeRow {
  event_key: string
  user_id: string
  liker: unknown
}

type DraftEvent = Omit<FeedEvent, "like_count" | "liked_by_me" | "likers">

const EVENT_SELECT = `id, user_id, media_id,
  gut_rating, gut_rated_at,
  detailed_enjoyment, detailed_impact, detailed_recommend, detailed_watch_again, detailed_rated_at,
  media:media_id (title, media_type, year, poster_path, tmdb_id)`

const SEASON_SELECT = `user_id, media_id, season_number, rating, dnf, updated_at,
  media:media_id (title, media_type, year, poster_path, tmdb_id)`

function normalizeMedia(raw: RatingEventRow["media"] | SeasonEventRow["media"]): FeedMedia | null {
  if (!raw?.title || !raw.media_type) return null
  return {
    title: raw.title,
    media_type: raw.media_type,
    year: raw.year ?? null,
    poster_path: raw.poster_path ?? null,
    tmdb_id: raw.tmdb_id ?? 0,
  }
}

function asMedia(raw: unknown): RatingEventRow["media"] {
  return Array.isArray(raw) ? (raw[0] as RatingEventRow["media"]) : (raw as RatingEventRow["media"])
}

async function attachLikes(
  supabase: SupabaseClient,
  viewerId: string,
  page: DraftEvent[]
): Promise<FeedEvent[]> {
  if (page.length === 0) return []

  const { data } = await supabase
    .from("feed_likes")
    .select("event_key, user_id, liker:user_id (username, display_name)")
    .in("event_key", page.map((e) => e.key))

  const byKey = new Map<string, { liked: boolean; likers: FeedLiker[] }>()
  for (const row of (data ?? []) as unknown as LikeRow[]) {
    let entry = byKey.get(row.event_key)
    if (!entry) {
      entry = { liked: false, likers: [] }
      byKey.set(row.event_key, entry)
    }
    if (row.user_id === viewerId) entry.liked = true
    const liker = Array.isArray(row.liker) ? row.liker[0] : row.liker
    if (liker?.username) {
      entry.likers.push({ username: liker.username, display_name: liker.display_name ?? null })
    }
  }

  return page.map((event) => {
    const likes = byKey.get(event.key) ?? { liked: false, likers: [] }
    return {
      ...event,
      like_count: likes.likers.length,
      liked_by_me: likes.liked,
      likers: likes.likers,
    }
  })
}

export async function fetchSocialFeed(
  supabase: SupabaseClient,
  viewerId: string,
  opts: { limit?: number; before?: string | null } = {}
): Promise<FeedPage> {
  const limit = Math.min(Math.max(opts.limit ?? FEED_DEFAULT_LIMIT, 1), FEED_MAX_LIMIT)
  const before = opts.before ?? null

  const { data: followsData } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId)

  const ids = [viewerId, ...(followsData ?? []).map((f) => f.following_id as string)]

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", ids)

  const profileById = new Map<string, FeedUser>()
  for (const p of (profilesData ?? []) as ProfileRow[]) {
    profileById.set(p.id, {
      id: p.id,
      username: p.username ?? "unknown",
      display_name: p.display_name ?? null,
    })
  }

  const gutQuery = supabase
    .from("ratings")
    .select(EVENT_SELECT)
    .in("user_id", ids)
    .not("gut_rated_at", "is", null)
    .order("gut_rated_at", { ascending: false })
    .limit(limit)

  const detailedQuery = supabase
    .from("ratings")
    .select(EVENT_SELECT)
    .in("user_id", ids)
    .not("detailed_rated_at", "is", null)
    .order("detailed_rated_at", { ascending: false })
    .limit(limit)

  const seasonQuery = supabase
    .from("season_ratings")
    .select(SEASON_SELECT)
    .in("user_id", ids)
    .or("rating.not.is.null,dnf.eq.true")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (before) {
    gutQuery.lt("gut_rated_at", before)
    detailedQuery.lt("detailed_rated_at", before)
    seasonQuery.lt("updated_at", before)
  }

  const [gutRes, detailedRes, seasonRes] = await Promise.all([gutQuery, detailedQuery, seasonQuery])

  const events: DraftEvent[] = []

  for (const raw of ((gutRes.data ?? []) as unknown as RatingEventRow[])) {
    if (!raw.gut_rated_at || raw.gut_rating == null) continue
    const media = normalizeMedia(asMedia(raw.media))
    if (!media) continue
    const user = profileById.get(raw.user_id)
    if (!user) continue
    events.push({
      key: `gut:${raw.id}`,
      type: "gut",
      at: raw.gut_rated_at,
      user,
      media,
      entryId: raw.id,
      gut_rating: raw.gut_rating,
    })
  }

  for (const raw of ((detailedRes.data ?? []) as unknown as RatingEventRow[])) {
    if (!raw.detailed_rated_at) continue
    if (
      raw.detailed_enjoyment == null ||
      raw.detailed_impact == null ||
      raw.detailed_recommend == null ||
      raw.detailed_watch_again == null
    )
      continue
    const media = normalizeMedia(asMedia(raw.media))
    if (!media) continue
    const user = profileById.get(raw.user_id)
    if (!user) continue
    events.push({
      key: `detailed:${raw.id}`,
      type: "detailed",
      at: raw.detailed_rated_at,
      user,
      media,
      entryId: raw.id,
      detailed_total:
        raw.detailed_enjoyment + raw.detailed_impact + raw.detailed_recommend + raw.detailed_watch_again,
    })
  }

  const seasonRows = ((seasonRes.data ?? []) as unknown as SeasonEventRow[]).filter(
    (r) => r.rating != null || r.dnf
  )

  let entryIdByKey = new Map<string, string>()
  if (seasonRows.length > 0) {
    const mediaIds = [...new Set(seasonRows.map((r) => r.media_id))]
    const userIds = [...new Set(seasonRows.map((r) => r.user_id))]
    const { data: ratingLinks } = await supabase
      .from("ratings")
      .select("id, user_id, media_id")
      .in("user_id", userIds)
      .in("media_id", mediaIds)

    entryIdByKey = new Map(
      ((ratingLinks ?? []) as { id: string; user_id: string; media_id: string }[]).map((r) => [
        `${r.user_id}:${r.media_id}`,
        r.id,
      ])
    )
  }

  for (const raw of seasonRows) {
    const media = normalizeMedia(asMedia(raw.media))
    if (!media) continue
    const user = profileById.get(raw.user_id)
    if (!user) continue
    events.push({
      key: `season:${raw.user_id}:${raw.media_id}:${raw.season_number}`,
      type: "season",
      at: raw.updated_at,
      user,
      media,
      entryId: entryIdByKey.get(`${raw.user_id}:${raw.media_id}`) ?? null,
      season_number: raw.season_number,
      season_rating: raw.rating ?? undefined,
      dnf: raw.dnf,
    })
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const page = await attachLikes(supabase, viewerId, events.slice(0, limit))
  // Each source query is capped at `limit`, so a full page may hide older
  // items; hand back a cursor and let the next fetch return empty when done.
  const nextCursor = events.length >= limit ? (page[page.length - 1]?.at ?? null) : null

  return { events: page, nextCursor }
}
