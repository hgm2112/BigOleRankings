import type { SupabaseClient } from "@supabase/supabase-js"

export interface WatchCountResult {
  movieCompletedCount: number
  // TV: per season stats and full-series count
  fullSeriesRewatchCount: number
  // season_number -> { completed, ungroupedAdditional }
  seasonStats: Record<number, { completed: number; ungroupedAdditional: number }>
}

export interface RatingHistoryRow {
  id: string
  user_id: string
  media_id: string
  season_number: number | null
  rating_scope: "movie_overall" | "tv_overall" | "tv_season"
  rating_kind: "gut" | "detailed" | "season"
  prev_gut: number | null
  new_gut: number | null
  prev_detailed_enjoyment: number | null
  prev_detailed_impact: number | null
  prev_detailed_recommend: number | null
  prev_detailed_watch_again: number | null
  new_detailed_enjoyment: number | null
  new_detailed_impact: number | null
  new_detailed_recommend: number | null
  new_detailed_watch_again: number | null
  prev_season_rating: number | null
  prev_season_dnf: boolean | null
  new_season_rating: number | null
  new_season_dnf: boolean | null
  changed_at: string
  watch_period_id: string | null
  source: string | null
}

export async function fetchRatingHistory(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string
): Promise<RatingHistoryRow[]> {
  const { data, error } = await supabase
    .from("rating_history")
    .select(
      "id, user_id, media_id, season_number, rating_scope, rating_kind, prev_gut, new_gut, prev_detailed_enjoyment, prev_detailed_impact, prev_detailed_recommend, prev_detailed_watch_again, new_detailed_enjoyment, new_detailed_impact, new_detailed_recommend, new_detailed_watch_again, prev_season_rating, prev_season_dnf, new_season_rating, new_season_dnf, changed_at, watch_period_id, source"
    )
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .order("changed_at", { ascending: true })

  if (error) {
    // table may not exist yet in environments without migration; fail soft
    return []
  }
  return (data ?? []) as unknown as RatingHistoryRow[]
}

export async function fetchMovieCompletedCount(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("watch_periods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .eq("media_type", "movie")
    .eq("status", "finished")
    .not("ended_at", "is", null)

  if (error) return 0
  return count ?? 0
}

export async function fetchTvWatchStats(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string
): Promise<{ fullSeriesRewatchCount: number; seasonStats: Record<number, { completed: number; ungroupedAdditional: number }> }> {
  const [{ data: periods, error: pErr }, { count: fsCount, error: fsErr }] = await Promise.all([
    supabase
      .from("watch_periods")
      .select("id, season_number, status, ended_at, started_at, created_at, full_series_rewatch_id")
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .eq("media_type", "tv")
      .eq("status", "finished")
      .not("ended_at", "is", null)
      .not("season_number", "is", null),
    supabase
      .from("tv_full_series_rewatches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("media_id", mediaId),
  ])

  if (pErr) {
    return { fullSeriesRewatchCount: 0, seasonStats: {} }
  }

  type FinishedPeriodRow = {
    id: string
    season_number: number | null
    ended_at: string | null
    started_at: string | null
    created_at: string | null
    full_series_rewatch_id: string | null
  }

  const bySeason = new Map<number, FinishedPeriodRow[]>()
  for (const row of (periods ?? []) as FinishedPeriodRow[]) {
    const sn = row.season_number
    if (typeof sn !== "number") continue
    const list = bySeason.get(sn) ?? []
    list.push(row)
    bySeason.set(sn, list)
  }

  const seasonStats: Record<number, { completed: number; ungroupedAdditional: number }> = {}

  const orderCmp = (a: FinishedPeriodRow, b: FinishedPeriodRow) => {
    const ea = String(a.ended_at ?? "")
    const eb = String(b.ended_at ?? "")
    if (ea !== eb) return ea < eb ? -1 : 1
    const sa = String(a.started_at ?? "")
    const sb = String(b.started_at ?? "")
    if (sa !== sb) return sa < sb ? -1 : 1
    const ca = String(a.created_at ?? "")
    const cb = String(b.created_at ?? "")
    if (ca !== cb) return ca < cb ? -1 : 1
    return String(a.id).localeCompare(String(b.id))
  }

  for (const [sn, list] of bySeason.entries()) {
    const sorted = [...list].sort(orderCmp)
    const completed = sorted.length
    let ungroupedAdditional = 0
    for (let i = 1; i < sorted.length; i++) {
      if (!sorted[i].full_series_rewatch_id) ungroupedAdditional++
    }
    seasonStats[sn] = { completed, ungroupedAdditional }
  }

  return {
    fullSeriesRewatchCount: fsErr ? 0 : (fsCount ?? 0),
    seasonStats,
  }
}

export function detailedTotalFromRow(row: {
  detailed_enjoyment: number | null
  detailed_impact: number | null
  detailed_recommend: number | null
  detailed_watch_again: number | null
}): number | null {
  if (
    row.detailed_enjoyment == null ||
    row.detailed_impact == null ||
    row.detailed_recommend == null ||
    row.detailed_watch_again == null
  )
    return null
  return row.detailed_enjoyment + row.detailed_impact + row.detailed_recommend + row.detailed_watch_again
}
