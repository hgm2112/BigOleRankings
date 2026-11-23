import type { SupabaseClient } from "@supabase/supabase-js"

export interface WatchCountResult {
  movieRewatchCount: number
  // TV: per season stats and full-series count
  fullSeriesRewatchCount: number
  // season_number -> { completed, additional }
  seasonStats: Record<number, { completed: number; additional: number }>
}

export interface ManualRewatchCounts {
  /** Manual whole-title/movie counter (season_number IS NULL). */
  whole: number
  /** Manual per-season counters (TV season_number >= 1). */
  bySeason: Record<number, number>
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

export async function fetchManualRewatchCounts(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string
): Promise<ManualRewatchCounts> {
  const { data, error } = await supabase
    .from("manual_rewatch_counts")
    .select("season_number, count")
    .eq("user_id", userId)
    .eq("media_id", mediaId)

  if (error || !data) return { whole: 0, bySeason: {} }

  let whole = 0
  const bySeason: Record<number, number> = {}
  for (const row of data as Array<{ season_number: number | null; count: number | null }>) {
    const count = Math.max(0, Number(row.count ?? 0))
    if (row.season_number == null) {
      whole = count
    } else {
      bySeason[row.season_number] = count
    }
  }
  return { whole, bySeason }
}

export async function fetchMovieRewatchCount(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string
): Promise<number> {
  const [{ count, error }, manual] = await Promise.all([
    supabase
      .from("watch_periods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .eq("media_type", "movie")
      .eq("status", "finished")
      .not("ended_at", "is", null),
    fetchManualRewatchCounts(supabase, userId, mediaId),
  ])

  if (error) return manual.whole
  return Math.max(0, (count ?? 0) - 1) + manual.whole
}

export async function fetchTvWatchStats(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string
): Promise<{ fullSeriesRewatchCount: number; seasonStats: Record<number, { completed: number; additional: number }> }> {
  const [{ data: periods, error: pErr }, { count: fsCount, error: fsErr }, manual] = await Promise.all([
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
    fetchManualRewatchCounts(supabase, userId, mediaId),
  ])

  if (pErr) {
    return {
      fullSeriesRewatchCount: (fsErr ? 0 : (fsCount ?? 0)) + manual.whole,
      seasonStats: Object.fromEntries(
        Object.entries(manual.bySeason).map(([sn, c]) => [Number(sn), { completed: 0, additional: c }])
      ),
    }
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

  const seasonStats: Record<number, { completed: number; additional: number }> = {}

  for (const [sn, list] of bySeason.entries()) {
    const completed = list.length
    seasonStats[sn] = { completed, additional: Math.max(0, completed - 1) + (manual.bySeason[sn] ?? 0) }
  }
  // Include manual-only seasons (no watch periods).
  for (const [snStr, manualCount] of Object.entries(manual.bySeason)) {
    const sn = Number(snStr)
    if (!seasonStats[sn]) seasonStats[sn] = { completed: 0, additional: manualCount }
  }

  return {
    fullSeriesRewatchCount: (fsErr ? 0 : (fsCount ?? 0)) + manual.whole,
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
