// Shared select + flatten helpers for the ratings -> media -> (movies|tv_shows) shape.
// Used by both server pages and client components so the rest of the app keeps
// consuming a flat "entry" object.

export const ENTRY_SELECT = `id, user_id, media_id,
  gut_rating, gut_rated_at,
  detailed_enjoyment, detailed_impact, detailed_recommend, detailed_watch_again, detailed_rated_at,
  notes, weight, created_at, updated_at,
  media:media_id (id, tmdb_id, media_type, title, poster_path, year,
    movies:movies (id, runtime),
    tv_shows:tv_shows (id, status, next_air_date, network),
    seasons:seasons (id, season_number, name, air_year, episode_count, episode_runtime)
  )`

export interface FlatEntry {
  id: string
  user_id: string
  media_id: string
  tmdb_id: number
  media_type: string
  title: string
  poster_path: string | null
  year: number | null
  status: string | null
  next_air_date: string | null
  runtime: number | null
  network: string | null
  total_episodes: number
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

export function flattenEntry(row: any): FlatEntry {
  const m = row.media
  const tv = m?.tv_shows ?? null
  const movie = m?.movies ?? null
  const seasons: any[] = m?.seasons ?? []
  const totalEpisodes = seasons.reduce((sum: number, s: any) => sum + (s.episode_count ?? 0), 0)
  const totalRuntime = seasons.reduce((sum: number, s: any) => sum + (s.episode_runtime ?? 0) * (s.episode_count ?? 0), 0)

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
    status: isTv ? (tv?.status ?? null) : null,
    next_air_date: isTv ? (tv?.next_air_date ?? null) : null,
    runtime: isTv ? totalRuntime || null : (movie?.runtime ?? null),
    network: isTv ? (tv?.network ?? null) : null,
    total_episodes: isTv ? totalEpisodes : 0,
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

export function flattenEntries(rows: any[] | null): FlatEntry[] {
  return (rows || []).map(flattenEntry)
}
