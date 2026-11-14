import type { SupabaseClient } from "@supabase/supabase-js"

export const TMDB_BASE = "https://api.themoviedb.org/3"
export const TMDB_DELAY_MS = 250

export interface UpcomingShow {
  mediaId: string
  tmdbId: number
  title: string
  posterPath: string | null
  year: number | null
  status: string | null
  upcomingSeasonNumber: number | null
  upcomingReleaseDate: string | null
  lastCheckedAt: string | null
  recentReleaseSeasonNumber: number | null
  recentReleaseDate: string | null
  expectedSeasonNumber: number | null
}

export interface ReleaseRefreshResult {
  mediaId: string
  tmdbId: number
  title?: string | null
  ok: boolean
  error?: string
  upcomingSeasonNumber?: number | null
  upcomingReleaseDate?: string | null
  lastCheckedAt?: string | null
  recentReleaseSeasonNumber?: number | null
  recentReleaseDate?: string | null
  expectedSeasonNumber?: number | null
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return null as unknown as SupabaseClient | null
}

export function createServiceSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  // dynamic require to avoid bundling issues in edge? standard in this codebase
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function isFutureDate(dateStr: string | null | undefined, today: string): boolean {
  if (!dateStr) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  // treat strictly future as upcoming premiere (not today/past)
  return dateStr > today
}

function isRecentReleaseDate(dateStr: string | null | undefined, today: string): boolean {
  if (!dateStr) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(`${dateStr}T00:00:00Z`)
  const t = new Date(`${today}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || Number.isNaN(t.getTime())) return false
  const diffDays = Math.floor((t.getTime() - d.getTime()) / 86400000)
  return diffDays >= 0 && diffDays <= 30
}

function isCompleteEnoughTvDetails(item: any): boolean {
  // Complete enough to confirm release state: TV details payload with an id and an explicit seasons array.
  // Missing/malformed seasons means we cannot distinguish "none announced" from incomplete metadata.
  if (!item || typeof item !== "object") return false
  const id = item.id ?? item.tmdb_id
  if (typeof id !== "number" && typeof id !== "string") return false
  if (!Array.isArray(item.seasons)) return false
  return true
}

function computeExpectedSeasonNumber(seasons: { season_number: number }[]): number | null {
  let maxSeason: number | null = null
  for (const s of seasons) {
    if (typeof s?.season_number !== "number" || s.season_number < 1) continue
    if (maxSeason == null || s.season_number > maxSeason) maxSeason = s.season_number
  }
  return maxSeason == null ? null : maxSeason + 1
}

function pickRecentRelease(params: {
  prevUpcomingSeasonNumber: number | null
  prevUpcomingReleaseDate: string | null
  prevRecentSeasonNumber: number | null
  prevRecentReleaseDate: string | null
  derived: DerivedReleaseInfo
  today: string
}): { recentReleaseSeasonNumber: number | null; recentReleaseDate: string | null } {
  const { prevUpcomingSeasonNumber, prevUpcomingReleaseDate, prevRecentSeasonNumber, prevRecentReleaseDate, derived, today } = params
  let bestSeason: number | null = null
  let bestDate: string | null = null

  const consider = (season: number | null, date: string | null | undefined) => {
    if (!date || !isRecentReleaseDate(date, today)) return
    if (!bestDate || date > bestDate) {
      bestDate = date
      bestSeason = typeof season === "number" && season >= 1 ? season : null
    }
  }

  // A previously tracked upcoming premiere that has now landed (or is within window) becomes "new".
  consider(prevUpcomingSeasonNumber, prevUpcomingReleaseDate)
  // Keep existing recent release if still in window (newer releases may override below).
  consider(prevRecentSeasonNumber, prevRecentReleaseDate)

  // Scan known season premiere air_dates for recent releases (tracked season premieres).
  for (const s of derived.seasons) {
    consider(s.season_number, s.air_date)
  }

  return bestDate
    ? { recentReleaseSeasonNumber: bestSeason, recentReleaseDate: bestDate }
    : { recentReleaseSeasonNumber: null, recentReleaseDate: null }
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface DerivedReleaseInfo {
  status: string | null
  nextAirDate: string | null
  network: string | null
  upcomingSeasonNumber: number | null
  upcomingReleaseDate: string | null
  seasons: { season_number: number; name: string | null; air_year: number | null; episode_count: number; air_date: string | null }[]
}

export function deriveUpcomingRelease(item: any, today = todayIsoDate()): DerivedReleaseInfo {
  const status: string | null = item?.status ?? null
  const nextAirDate: string | null = item?.next_episode_to_air?.air_date ?? item?.next_air_date ?? null
  const network: string | null =
    item?.networks?.[0]?.name ??
    (typeof item?.network === "string" ? item.network : null) ??
    null

  const rawSeasons = Array.isArray(item?.seasons) ? item.seasons : []
  const seasons = rawSeasons
    .filter((s: any) => typeof s?.season_number === "number" && s.season_number >= 1)
    .map((s: any) => ({
      season_number: s.season_number as number,
      name: (s.name ?? null) as string | null,
      air_year: s.air_date ? Number(String(s.air_date).slice(0, 4)) : (typeof s.air_year === "number" ? s.air_year : null),
      episode_count: (s.episode_count ?? 0) as number,
      air_date: (s.air_date && /^\d{4}-\d{2}-\d{2}$/.test(s.air_date) ? s.air_date : null) as string | null,
    }))

  let upcomingSeasonNumber: number | null = null
  let upcomingReleaseDate: string | null = null

  const nextEp = item?.next_episode_to_air
  if (nextEp && typeof nextEp.season_number === "number" && nextEp.season_number >= 1) {
    const epDate = typeof nextEp.air_date === "string" ? nextEp.air_date : null
    const epNum = typeof nextEp.episode_number === "number" ? nextEp.episode_number : null
    if (epDate && isFutureDate(epDate, today)) {
      if (epNum === 1) {
        upcomingSeasonNumber = nextEp.season_number
        upcomingReleaseDate = epDate
      } else {
        // Season has already started airing (next episode is not the premiere).
        // Do not present as an upcoming premiere.
        upcomingSeasonNumber = null
        upcomingReleaseDate = null
      }
    }
    // if next episode date is not in future (or missing), fall through to season scan
  }

  if (upcomingReleaseDate == null) {
    // Fallback: earliest regular season with a known future premiere air_date.
    const candidates = seasons
      .filter((s: { air_date: string | null; season_number: number }) => s.air_date != null && isFutureDate(s.air_date, today))
      .sort((a: { air_date: string | null; season_number: number }, b: { air_date: string | null; season_number: number }) => {
        if (a.air_date! !== b.air_date!) return a.air_date! < b.air_date! ? -1 : 1
        return a.season_number - b.season_number
      })
    if (candidates.length > 0) {
      upcomingSeasonNumber = candidates[0].season_number
      upcomingReleaseDate = candidates[0].air_date
    } else {
      upcomingSeasonNumber = null
      upcomingReleaseDate = null
    }
  }

  return { status, nextAirDate, network, upcomingSeasonNumber, upcomingReleaseDate, seasons }
}

export async function persistReleaseInfoFromTmdbItem(
  service: SupabaseClient,
  mediaId: string,
  tmdbId: number,
  item: any
): Promise<ReleaseRefreshResult> {
  try {
    const today = todayIsoDate()

    // Read previous state to detect landed premieres, preserve/roll recent releases,
    // and to preserve known info when TMDB data is incomplete/unreliable.
    const { data: prev } = await service
      .from("tv_shows")
      .select("upcoming_season_number, upcoming_release_date, recent_release_season_number, recent_release_date, expected_season_number, release_info_last_checked_at")
      .eq("id", mediaId)
      .maybeSingle()

    if (!isCompleteEnoughTvDetails(item)) {
      // Incomplete/missing metadata: do not erase prior known info or claim a successful check.
      return {
        mediaId,
        tmdbId,
        ok: false,
        error: "Incomplete TMDB data",
        upcomingSeasonNumber: (prev as any)?.upcoming_season_number ?? null,
        upcomingReleaseDate: (prev as any)?.upcoming_release_date ?? null,
        recentReleaseSeasonNumber: (prev as any)?.recent_release_season_number ?? null,
        recentReleaseDate: (prev as any)?.recent_release_date ?? null,
        expectedSeasonNumber: (prev as any)?.expected_season_number ?? null,
        lastCheckedAt: (prev as any)?.release_info_last_checked_at ?? null,
      }
    }

    const derived = deriveUpcomingRelease(item, today)
    const recent = pickRecentRelease({
      prevUpcomingSeasonNumber: (prev as any)?.upcoming_season_number ?? null,
      prevUpcomingReleaseDate: (prev as any)?.upcoming_release_date ?? null,
      prevRecentSeasonNumber: (prev as any)?.recent_release_season_number ?? null,
      prevRecentReleaseDate: (prev as any)?.recent_release_date ?? null,
      derived,
      today,
    })

    // Upcoming = next strictly-future premiere (may coexist in storage; UI exclusivity handled separately).
    let upcomingSeasonNumber = derived.upcomingSeasonNumber
    let upcomingReleaseDate = derived.upcomingReleaseDate
    if (upcomingReleaseDate && !isFutureDate(upcomingReleaseDate, today)) {
      upcomingSeasonNumber = null
      upcomingReleaseDate = null
    }

    // Expected next season for awaiting state: next after highest known regular season seen.
    const expectedSeasonNumber = computeExpectedSeasonNumber(derived.seasons)

    // Upsert seasons first; if this fails, do not mark the show as successfully checked
    // and do not overwrite stored release info/last-checked timestamp.
    if (derived.seasons.length > 0) {
      const seasonRows = derived.seasons.map((s) => ({
        media_id: mediaId,
        season_number: s.season_number,
        name: s.name,
        air_year: s.air_year,
        episode_count: s.episode_count,
        air_date: s.air_date,
      }))
      const { error: seasonsError } = await service.from("seasons").upsert(seasonRows, {
        onConflict: "media_id,season_number",
      })
      if (seasonsError) {
        return { mediaId, tmdbId, ok: false, error: seasonsError.message }
      }
    }

    const checkedAt = new Date().toISOString()
    const { error: tvError } = await service
      .from("tv_shows")
      .update({
        status: derived.status,
        next_air_date: derived.nextAirDate,
        network: derived.network,
        upcoming_season_number: upcomingSeasonNumber,
        upcoming_release_date: upcomingReleaseDate,
        recent_release_season_number: recent.recentReleaseSeasonNumber,
        recent_release_date: recent.recentReleaseDate,
        expected_season_number: expectedSeasonNumber,
        release_info_last_checked_at: checkedAt,
      })
      .eq("id", mediaId)

    if (tvError) {
      return { mediaId, tmdbId, ok: false, error: tvError.message }
    }

    return {
      mediaId,
      tmdbId,
      ok: true,
      upcomingSeasonNumber,
      upcomingReleaseDate,
      recentReleaseSeasonNumber: recent.recentReleaseSeasonNumber,
      recentReleaseDate: recent.recentReleaseDate,
      expectedSeasonNumber,
      lastCheckedAt: checkedAt,
    }
  } catch (e: any) {
    return { mediaId, tmdbId, ok: false, error: e?.message || "Persist failed" }
  }
}

export async function fetchAndPersistShowReleaseInfo(
  service: SupabaseClient,
  mediaId: string,
  tmdbId: number,
  token: string
): Promise<ReleaseRefreshResult> {
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?language=en-US`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      // Request failed/non-OK: preserve all previously stored release info and last successful check timestamp.
      return { mediaId, tmdbId, ok: false, error: `TMDB ${res.status}` }
    }
    const item = await res.json()
    return persistReleaseInfoFromTmdbItem(service, mediaId, tmdbId, item)
  } catch (e: any) {
    // Network/exception: preserve all previously stored release info and last successful check timestamp.
    return { mediaId, tmdbId, ok: false, error: e?.message || "Request failed" }
  }
}

export async function getEligibleUpcomingShowsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<UpcomingShow[]> {
  const { data, error } = await supabase
    .from("ratings")
    .select(
      `media_id,
       media:media_id!inner (
         id, tmdb_id, media_type, title, poster_path, year,
         tv_shows:tv_shows!inner (status, upcoming_season_number, upcoming_release_date, release_info_last_checked_at, recent_release_season_number, recent_release_date, expected_season_number)
       )`
    )
    .eq("user_id", userId)
    .eq("media.media_type", "tv")
    .eq("media.tv_shows.status", "Returning Series")

  if (error || !data) return []

  const byMedia = new Map<string, UpcomingShow>()
  for (const row of data as any[]) {
    const m = Array.isArray(row.media) ? row.media[0] : row.media
    if (!m) continue
    const tv = Array.isArray(m.tv_shows) ? m.tv_shows[0] : m.tv_shows
    if (!tv) continue
    const mediaId = m.id as string
    if (byMedia.has(mediaId)) continue
    byMedia.set(mediaId, {
      mediaId,
      tmdbId: m.tmdb_id as number,
      title: m.title as string,
      posterPath: (m.poster_path ?? null) as string | null,
      year: (m.year ?? null) as number | null,
      status: (tv.status ?? null) as string | null,
      upcomingSeasonNumber: (tv.upcoming_season_number ?? null) as number | null,
      upcomingReleaseDate: (tv.upcoming_release_date ?? null) as string | null,
      lastCheckedAt: (tv.release_info_last_checked_at ?? null) as string | null,
      recentReleaseSeasonNumber: (tv.recent_release_season_number ?? null) as number | null,
      recentReleaseDate: (tv.recent_release_date ?? null) as string | null,
      expectedSeasonNumber: (tv.expected_season_number ?? null) as number | null,
    })
  }
  return Array.from(byMedia.values())
}
