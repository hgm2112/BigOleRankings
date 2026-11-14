import type { SupabaseClient } from "@supabase/supabase-js"

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN
const TMDB_BASE = "https://api.themoviedb.org/3"

export type WatchlistReason = "already_on_watchlist" | "currently_watching" | "already_watched_or_rated"

export interface WatchlistEligibility {
  eligible: boolean
  onWatchlist: boolean
  reason: WatchlistReason | null
}

function toReason(currentlyWatching: boolean): WatchlistReason {
  return currentlyWatching ? "currently_watching" : "already_watched_or_rated"
}

export async function getWatchlistEligibilityForMediaIds(
  supabase: SupabaseClient,
  userId: string,
  mediaIds: string[]
): Promise<Map<string, WatchlistEligibility>> {
  const map = new Map<string, WatchlistEligibility>()
  if (mediaIds.length === 0) return map

  const ids = Array.from(new Set(mediaIds))

  const [watchlistRes, ratingsRes, seasonRatingsRes, periodsRes] = await Promise.all([
    supabase.from("watchlist").select("media_id").eq("user_id", userId).in("media_id", ids),
    supabase.from("ratings").select("media_id").eq("user_id", userId).in("media_id", ids),
    supabase.from("season_ratings").select("media_id").eq("user_id", userId).in("media_id", ids),
    supabase
      .from("watch_periods")
      .select("media_id, status")
      .eq("user_id", userId)
      .in("media_id", ids),
  ])

  const onWatchlist = new Set((watchlistRes.data ?? []).map((r: any) => r.media_id as string))
  const hasRating = new Set((ratingsRes.data ?? []).map((r: any) => r.media_id as string))
  const hasSeasonRating = new Set((seasonRatingsRes.data ?? []).map((r: any) => r.media_id as string))
  const hasAnyPeriod = new Set<string>()
  const hasActivePeriod = new Set<string>()
  for (const r of periodsRes.data ?? []) {
    const mid = (r as any).media_id as string
    hasAnyPeriod.add(mid)
    if ((r as any).status === "currently_watching") hasActivePeriod.add(mid)
  }

  for (const mediaId of ids) {
    if (onWatchlist.has(mediaId)) {
      map.set(mediaId, { eligible: false, onWatchlist: true, reason: "already_on_watchlist" })
      continue
    }
    const watchedOrRated =
      hasRating.has(mediaId) || hasSeasonRating.has(mediaId) || hasAnyPeriod.has(mediaId)
    if (watchedOrRated) {
      map.set(mediaId, {
        eligible: false,
        onWatchlist: false,
        reason: toReason(hasActivePeriod.has(mediaId)),
      })
      continue
    }
    map.set(mediaId, { eligible: true, onWatchlist: false, reason: null })
  }

  return map
}

export async function getWatchlistEligibilityForMediaId(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string
): Promise<WatchlistEligibility> {
  const map = await getWatchlistEligibilityForMediaIds(supabase, userId, [mediaId])
  return map.get(mediaId) ?? { eligible: true, onWatchlist: false, reason: null }
}

export function reasonLabel(reason: WatchlistReason | null): string | null {
  switch (reason) {
    case "currently_watching":
      return "Currently watching"
    case "already_watched_or_rated":
      return "Already watched or rated"
    case "already_on_watchlist":
      return "Already on Watchlist"
    default:
      return null
  }
}

export interface WatchlistItem {
  id: string
  media_id: string
  created_at: string
  tmdb_id: number
  media_type: "movie" | "tv"
  title: string
  poster_path: string | null
  year: number | null
  season_count: number | null
}

export const WATCHLIST_SELECT = `
  id, media_id, created_at,
  media:media_id (id, tmdb_id, media_type, title, poster_path, year, seasons(season_number))
`

export function normalizeWatchlistRows(rows: any[] | null | undefined): WatchlistItem[] {
  return (rows ?? [])
    .map((row: any) => {
      const media = Array.isArray(row?.media) ? row.media[0] : row?.media
      if (!media || !row?.id) return null
      const seasons = Array.isArray(media.seasons) ? media.seasons : []
      const seasonCount =
        media.media_type === "tv"
          ? seasons.filter((s: any) => typeof s?.season_number === "number" && s.season_number >= 1).length
          : 0
      return {
        id: row.id as string,
        media_id: row.media_id as string,
        created_at: row.created_at as string,
        tmdb_id: media.tmdb_id as number,
        media_type: media.media_type as "movie" | "tv",
        title: media.title as string,
        poster_path: (media.poster_path ?? null) as string | null,
        year: (media.year ?? null) as number | null,
        season_count: seasonCount > 0 ? seasonCount : null,
      } satisfies WatchlistItem
    })
    .filter((r): r is WatchlistItem => !!r)
}

export async function ensureTvSeasons(service: SupabaseClient, tmdbId: number, mediaId: string) {
  if (!TMDB_ACCESS_TOKEN) return
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?language=en-US`, {
      headers: { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}` },
    })
    if (!res.ok) return
    const item = await res.json()
    const rows = (item.seasons || [])
      .filter((s: any) => typeof s?.season_number === "number" && s.season_number >= 1)
      .map((s: any) => ({
        media_id: mediaId,
        season_number: s.season_number as number,
        name: (s.name ?? null) as string | null,
        air_year: s.air_date ? Number(String(s.air_date).slice(0, 4)) : null,
        episode_count: typeof s.episode_count === "number" ? s.episode_count : 0,
        episode_runtime: Array.isArray(item.episode_run_time) && typeof item.episode_run_time[0] === "number"
          ? item.episode_run_time[0]
          : null,
      }))
    if (rows.length === 0) return
    const { error } = await service.from("seasons").upsert(rows, { onConflict: "media_id,season_number" })
    if (error) console.error("Failed to upsert seasons for TV media", error)
  } catch (e) {
    console.error("Failed to fetch/upsert TV seasons", e)
  }
}

export async function backfillMissingTvSeasonCounts(
  service: SupabaseClient | null,
  rows: any[] | null | undefined
): Promise<{ changed: boolean }> {
  if (!service || !rows || rows.length === 0) return { changed: false }
  const missing = rows.filter((row: any) => {
    const media = Array.isArray(row?.media) ? row.media[0] : row?.media
    if (!media || media.media_type !== "tv") return false
    const seasons = Array.isArray(media.seasons) ? media.seasons : []
    const count = seasons.filter((s: any) => typeof s?.season_number === "number" && s.season_number >= 1).length
    return count === 0 && typeof media.tmdb_id === "number" && typeof media.id === "string"
  })
  if (missing.length === 0) return { changed: false }
  await Promise.all(missing.map((row: any) => {
    const media = Array.isArray(row?.media) ? row.media[0] : row?.media
    return ensureTvSeasons(service, media.tmdb_id, media.id)
  }))
  return { changed: true }
}
