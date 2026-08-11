// Shared select + flatten helpers for the ratings -> media -> (movies|tv_shows) shape.
// Used by both server pages and client components so the rest of the app keeps
// consuming a flat "entry" object.

import type { SupabaseClient } from "@supabase/supabase-js"

export const ENTRY_SELECT = `id, user_id, media_id,
  gut_rating, gut_rated_at,
  detailed_enjoyment, detailed_impact, detailed_recommend, detailed_watch_again, detailed_rated_at,
  notes, weight, created_at, updated_at,
  media:media_id (id, tmdb_id, media_type, title, poster_path, year, genres,
    movies:movies (id, runtime),
    tv_shows:tv_shows (id, status, next_air_date, network),
    seasons:seasons (id, season_number, name, air_year, episode_count, episode_runtime)
  )`

export interface FlatSeason {
  id: string
  season_number: number
  name: string | null
  air_year: number | null
  episode_count: number | null
  episode_runtime: number | null
}

export interface FlatEntry {
  id: string
  user_id: string
  media_id: string
  tmdb_id: number
  media_type: string
  title: string
  poster_path: string | null
  year: number | null
  genres: string[] | null
  status: string | null
  next_air_date: string | null
  runtime: number | null
  network: string | null
  total_episodes: number
  seasons: FlatSeason[]
  gut_rating: number | null
  gut_rated_at: string | null
  detailed_enjoyment: number | null
  detailed_impact: number | null
  detailed_recommend: number | null
  detailed_watch_again: number | null
  detailed_rated_at: string | null
  notes: string | null
  weight: number
  created_at: string
  updated_at: string
}

export function flattenEntry(row: any, dnfSeasonKeys?: Set<string>): FlatEntry {
  const m = row.media
  const tv = m?.tv_shows ?? null
  const movie = m?.movies ?? null
  const seasons: any[] = m?.seasons ?? []
  const totalEpisodes = seasons.reduce((sum: number, s: any) => sum + (s.episode_count ?? 0), 0)
  const totalRuntime = seasons.reduce((sum: number, s: any) => {
    if (dnfSeasonKeys?.has(`${m?.id}:${s.season_number}`)) return sum
    return sum + (s.episode_runtime ?? 0) * (s.episode_count ?? 0)
  }, 0)

  const isTv = m?.media_type === "tv"

  return {
    id: row.id,
    user_id: row.user_id,
    media_id: m?.id ?? "",
    tmdb_id: m?.tmdb_id ?? 0,
    media_type: m?.media_type ?? "",
    title: m?.title ?? "",
    poster_path: m?.poster_path ?? null,
    year: m?.year ?? null,
    genres: m?.genres ?? null,
    status: isTv ? (tv?.status ?? null) : null,
    next_air_date: isTv ? (tv?.next_air_date ?? null) : null,
    runtime: isTv ? totalRuntime || null : (movie?.runtime ?? null),
    network: isTv ? (tv?.network ?? null) : null,
    total_episodes: isTv ? totalEpisodes : 0,
    seasons: isTv ? seasons.map((s) => ({
      id: s.id,
      season_number: s.season_number,
      name: s.name ?? null,
      air_year: s.air_year ?? null,
      episode_count: s.episode_count ?? null,
      episode_runtime: s.episode_runtime ?? null,
    })) : [],
    gut_rating: row.gut_rating,
    gut_rated_at: row.gut_rated_at,
    detailed_enjoyment: row.detailed_enjoyment,
    detailed_impact: row.detailed_impact,
    detailed_recommend: row.detailed_recommend,
    detailed_watch_again: row.detailed_watch_again,
    detailed_rated_at: row.detailed_rated_at,
    notes: row.notes,
    weight: row.weight,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function flattenEntries(rows: any[] | null, dnfSeasonKeys?: Set<string>): FlatEntry[] {
  return (rows || []).map((row) => flattenEntry(row, dnfSeasonKeys))
}

export async function fetchDnfSeasonKeys(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const keys = new Set<string>()
  const { data } = await supabase
    .from("season_ratings")
    .select("media_id, season_number")
    .eq("user_id", userId)
    .eq("dnf", true)
  for (const row of data ?? []) {
    keys.add(`${row.media_id}:${row.season_number}`)
  }
  return keys
}
