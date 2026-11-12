import type { SupabaseClient } from "@supabase/supabase-js"

export type WatchStatus = "currently_watching" | "finished" | "dnf" | "stopped"
export type WatchActivityType = "started" | "finished" | "stopped" | "dnf"

export interface WatchPeriod {
  id: string
  user_id: string
  media_id: string
  media_type: "movie" | "tv"
  season_number: number | null
  status: WatchStatus
  started_at: string // YYYY-MM-DD
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface WatchMedia {
  id: string
  tmdb_id: number
  media_type: "movie" | "tv"
  title: string
  poster_path: string | null
  year: number | null
}

export interface WatchPeriodWithMedia extends WatchPeriod {
  media: WatchMedia
}

export const WATCH_PERIOD_SELECT = `
  id, user_id, media_id, media_type, season_number, status, started_at, ended_at, created_at, updated_at,
  media:media_id (id, tmdb_id, media_type, title, poster_path, year)
`

function asSingle<T>(raw: T | T[] | null): T | null {
  if (!raw) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

export function normalizeWatchPeriod(row: any): WatchPeriodWithMedia | null {
  const media = asSingle(row?.media) as WatchMedia | null
  if (!media || !row?.id) return null
  return {
    id: row.id,
    user_id: row.user_id,
    media_id: row.media_id,
    media_type: row.media_type,
    season_number: row.season_number ?? null,
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    media,
  }
}

export function normalizeWatchPeriods(rows: any[] | null | undefined): WatchPeriodWithMedia[] {
  return (rows ?? []).map(normalizeWatchPeriod).filter((r): r is WatchPeriodWithMedia => !!r)
}

export function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "In progress"
  const start = new Date(`${startedAt}T00:00:00`)
  const end = new Date(`${endedAt}T00:00:00`)
  const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays <= 0) return "Same day"
  return `${diffDays} day${diffDays === 1 ? "" : "s"}`
}

export function todayLocalDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export async function fetchActiveWatchPeriods(
  supabase: SupabaseClient,
  userId: string
): Promise<WatchPeriodWithMedia[]> {
  const { data } = await supabase
    .from("watch_periods")
    .select(WATCH_PERIOD_SELECT)
    .eq("user_id", userId)
    .eq("status", "currently_watching")
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false })
  return normalizeWatchPeriods(data)
}

export async function fetchWatchHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<WatchPeriodWithMedia[]> {
  const { data } = await supabase
    .from("watch_periods")
    .select(WATCH_PERIOD_SELECT)
    .eq("user_id", userId)
    .neq("status", "currently_watching")
    .order("ended_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
  return normalizeWatchPeriods(data)
}

export async function fetchAllWatchPeriodsForMedia(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string
): Promise<WatchPeriodWithMedia[]> {
  const { data } = await supabase
    .from("watch_periods")
    .select(WATCH_PERIOD_SELECT)
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .order("season_number", { ascending: true, nullsFirst: true })
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false })
  return normalizeWatchPeriods(data)
}

export function periodLabel(p: { media_type: "movie" | "tv"; season_number: number | null }): string {
  if (p.media_type === "tv" && p.season_number != null) return `Season ${p.season_number}`
  return "Movie"
}
