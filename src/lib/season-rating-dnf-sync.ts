import type { SupabaseClient } from "@supabase/supabase-js"

export type SyncDnfOutcome =
  | { status: "updated"; periodId: string; updatedCount: number }
  | { status: "no-op"; reason: string }
  | { status: "error"; reason: string; updatedCount?: number }

/**
 * Server-side only. Syncs DNF state from season_ratings to watch_periods.
 * Verifies season_ratings.dnf is true for (user,media,season) before acting.
 *
 * Rules:
 * - watch_periods.status is authoritative outcome; when a season becomes DNF,
 *   set status='dnf' on only the MOST RECENT watch period for (user,media,season).
 * - Never rewrite older periods (rewatch history). Never create periods.
 * - Only touch periods whose current status is 'finished'.
 */
export async function syncDnfToPeriod(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string,
  seasonNumber: number
): Promise<SyncDnfOutcome> {
  if (!userId || !mediaId || !Number.isInteger(seasonNumber) || seasonNumber < 1) {
    const outcome: SyncDnfOutcome = { status: "no-op", reason: "invalid input" }
    console.warn("syncDnfToPeriod: no-op", { userId, mediaId, seasonNumber, outcome })
    return outcome
  }

  const { data: sr, error: srErr } = await supabase
    .from("season_ratings")
    .select("dnf")
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .eq("season_number", seasonNumber)
    .maybeSingle()

  if (srErr) {
    const outcome: SyncDnfOutcome = { status: "error", reason: "failed to read season_rating" }
    console.error("syncDnfToPeriod: failed to read season_rating", { userId, mediaId, seasonNumber, error: srErr, outcome })
    return outcome
  }

  if (!sr || sr.dnf !== true) {
    const outcome: SyncDnfOutcome = { status: "no-op", reason: "season_rating not dnf" }
    console.info("syncDnfToPeriod: no-op", { userId, mediaId, seasonNumber, outcome })
    return outcome
  }

  const { data: activePeriod, error: activeErr } = await supabase
    .from("watch_periods")
    .select("id")
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .eq("season_number", seasonNumber)
    .eq("status", "currently_watching")
    .limit(1)
    .maybeSingle()

  if (activeErr) {
    const outcome: SyncDnfOutcome = { status: "error", reason: "failed to check for currently_watching period" }
    console.error("syncDnfToPeriod: failed to check active period", { userId, mediaId, seasonNumber, error: activeErr, outcome })
    return outcome
  }

  if (activePeriod) {
    const outcome: SyncDnfOutcome = { status: "no-op", reason: "currently_watching period exists (rewatch in progress)" }
    console.info("syncDnfToPeriod: no-op", { userId, mediaId, seasonNumber, periodId: activePeriod.id, outcome })
    return outcome
  }

  const { data: period, error: findErr } = await supabase
    .from("watch_periods")
    .select("id, status, ended_at, started_at, created_at")
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .eq("season_number", seasonNumber)
    .order("ended_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findErr) {
    const outcome: SyncDnfOutcome = { status: "error", reason: "failed to find watch_period" }
    console.error("syncDnfToPeriod: failed to find period", { userId, mediaId, seasonNumber, error: findErr, outcome })
    return outcome
  }

  if (!period) {
    const outcome: SyncDnfOutcome = { status: "no-op", reason: "no matching watch_period" }
    console.info("syncDnfToPeriod: no-op", { userId, mediaId, seasonNumber, outcome })
    return outcome
  }

  if (period.status !== "finished") {
    const outcome: SyncDnfOutcome = { status: "no-op", reason: `most recent period status is ${period.status}` }
    console.info("syncDnfToPeriod: no-op", { userId, mediaId, seasonNumber, periodId: period.id, outcome })
    return outcome
  }

  const { data: updatedRows, error: updateErr } = await supabase
    .from("watch_periods")
    .update({ status: "dnf" })
    .eq("id", period.id)
    .eq("user_id", userId)
    .eq("status", "finished")
    .select("id")

  if (updateErr) {
    const outcome: SyncDnfOutcome = { status: "error", reason: "failed to update watch_period" }
    console.error("syncDnfToPeriod: failed to update period", { userId, mediaId, seasonNumber, periodId: period.id, error: updateErr, outcome })
    return outcome
  }

  const updatedCount = updatedRows?.length ?? 0
  if (updatedCount === 0) {
    const outcome: SyncDnfOutcome = { status: "no-op", reason: "no finished period row updated (concurrent change?)" }
    console.warn("syncDnfToPeriod: no-op", { userId, mediaId, seasonNumber, periodId: period.id, outcome })
    return outcome
  }

  const outcome: SyncDnfOutcome = { status: "updated", periodId: period.id, updatedCount }
  console.info("syncDnfToPeriod: updated", { userId, mediaId, seasonNumber, outcome })
  return outcome
}
