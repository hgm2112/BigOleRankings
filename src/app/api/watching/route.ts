import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"

type WatchStatus = "currently_watching" | "finished" | "dnf" | "stopped"
type WatchActivityType = "started" | "finished" | "stopped" | "dnf"

function isValidDateString(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
}

function isValidSeasonNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1
}

async function ensureMedia(service: any, body: any): Promise<{ mediaId: string } | { error: string; status: number }> {
  const mediaType = body.media_type
  if (mediaType !== "movie" && mediaType !== "tv") {
    return { error: "Invalid media_type", status: 400 }
  }
  if (typeof body.tmdb_id !== "number") return { error: "tmdb_id required", status: 400 }
  if (typeof body.title !== "string" || !body.title) return { error: "title required", status: 400 }

  const { data: mediaRow, error: mediaError } = await service
    .from("media")
    .upsert(
      {
        tmdb_id: body.tmdb_id,
        media_type: mediaType,
        title: body.title,
        poster_path: body.poster_path ?? null,
        year: body.year ?? null,
        genres: Array.isArray(body.genres) ? body.genres : null,
      },
      { onConflict: "tmdb_id,media_type" }
    )
    .select("id")
    .single()

  if (mediaError || !mediaRow) {
    return { error: mediaError?.message ?? "Failed to save media", status: 500 }
  }

  const mediaId = mediaRow.id as string

  if (mediaType === "movie") {
    const { error } = await service
      .from("movies")
      .upsert({ id: mediaId, runtime: body.runtime ?? null }, { onConflict: "id" })
    if (error) return { error: error.message, status: 500 }
  } else {
    const { error: tvError } = await service
      .from("tv_shows")
      .upsert(
        {
          id: mediaId,
          status: body.status ?? null,
          next_air_date: body.next_air_date ?? null,
          network: body.network ?? null,
        },
        { onConflict: "id" }
      )
    if (tvError) return { error: tvError.message, status: 500 }

    const seasons = Array.isArray(body.seasons) ? body.seasons : []
    if (seasons.length > 0) {
      const rows = seasons
        .filter((s: any) => isValidSeasonNumber(s?.season_number))
        .map((s: any) => ({
          media_id: mediaId,
          season_number: s.season_number,
          name: s.name ?? null,
          air_year: s.air_year ?? null,
          episode_count: typeof s.episode_count === "number" ? s.episode_count : 0,
          episode_runtime: typeof s.episode_runtime === "number" ? s.episode_runtime : null,
        }))
      if (rows.length > 0) {
        const { error: seasonsError } = await service
          .from("seasons")
          .upsert(rows, { onConflict: "media_id,season_number" })
        if (seasonsError) return { error: seasonsError.message, status: 500 }
      }
    }
  }

  return { mediaId }
}

async function insertActivity(
  supabase: any,
  params: {
    user_id: string
    media_id: string
    period_id: string
    event_type: WatchActivityType
    season_number: number | null
  }
) {
  const { error } = await supabase.from("watch_activities").insert({
    user_id: params.user_id,
    media_id: params.media_id,
    period_id: params.period_id,
    event_type: params.event_type,
    season_number: params.season_number,
  })
  return error
}

export async function POST(request: NextRequest) {
  const supabase = await createUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const action = body?.action as string | undefined

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceUrl || !serviceKey) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }
  const service = createClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    if (action === "start") {
      const mediaType = body.media_type
      if (mediaType !== "movie" && mediaType !== "tv") {
        return Response.json({ error: "Invalid media_type" }, { status: 400 })
      }
      const seasonNumber = mediaType === "tv" ? body.season_number : null
      if (mediaType === "tv" && !isValidSeasonNumber(seasonNumber)) {
        return Response.json({ error: "season_number required for TV" }, { status: 400 })
      }
      const startedAt = isValidDateString(body.started_at)
        ? body.started_at
        : new Date().toISOString().slice(0, 10)

      const ensured = await ensureMedia(service, body)
      if ("error" in ensured) return Response.json({ error: ensured.error }, { status: ensured.status })
      const mediaId = ensured.mediaId

      const { data: period, error: periodError } = await supabase
        .from("watch_periods")
        .insert({
          user_id: user.id,
          media_id: mediaId,
          media_type: mediaType,
          season_number: mediaType === "tv" ? seasonNumber : null,
          status: "currently_watching",
          started_at: startedAt,
          ended_at: null,
        })
        .select("id")
        .single()

      if (periodError || !period) {
        if (periodError?.code === "23505") {
          return Response.json({ error: "Already currently watching this title/season." }, { status: 409 })
        }
        return Response.json({ error: periodError?.message ?? "Failed to start watching" }, { status: 500 })
      }

      const actErr = await insertActivity(supabase, {
        user_id: user.id,
        media_id: mediaId,
        period_id: period.id,
        event_type: "started",
        season_number: mediaType === "tv" ? (seasonNumber as number) : null,
      })
      if (actErr) {
        // best-effort: period exists; report but don't fail hard
        console.error("Failed to insert watch activity", actErr)
      }

      return Response.json({ success: true, period_id: period.id, media_id: mediaId })
    }

    if (action === "transition") {
      const periodId = body.period_id
      const toStatus = body.status as WatchStatus
      if (typeof periodId !== "string") return Response.json({ error: "period_id required" }, { status: 400 })
      if (!["finished", "dnf", "stopped"].includes(toStatus)) {
        return Response.json({ error: "Invalid status transition" }, { status: 400 })
      }
      const endedAt = isValidDateString(body.ended_at)
        ? body.ended_at
        : new Date().toISOString().slice(0, 10)

      const { data: existing, error: fetchErr } = await supabase
        .from("watch_periods")
        .select("id, user_id, media_id, season_number, status, started_at")
        .eq("id", periodId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (fetchErr || !existing) {
        return Response.json({ error: "Watch period not found" }, { status: 404 })
      }
      if (existing.status !== "currently_watching") {
        return Response.json({ error: "Only active periods can be finished, stopped, or marked DNF" }, { status: 400 })
      }
      if (endedAt < existing.started_at) {
        return Response.json({ error: "End date cannot be before start date" }, { status: 400 })
      }

      const { error: updateErr } = await supabase
        .from("watch_periods")
        .update({ status: toStatus, ended_at: endedAt })
        .eq("id", periodId)
        .eq("user_id", user.id)

      if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

      const actErr = await insertActivity(supabase, {
        user_id: user.id,
        media_id: existing.media_id,
        period_id: existing.id,
        event_type: toStatus as WatchActivityType,
        season_number: existing.season_number ?? null,
      })
      if (actErr) console.error("Failed to insert watch activity", actErr)

      // After a TV season is finished, attempt full-series rewatch recognition
      // (idempotent; no-op if migration/metadata/eligibility not ready).
      if (toStatus === "finished" && existing.season_number != null) {
        try {
          await supabase.rpc("recognize_tv_full_series_rewatches", {
            p_user_id: user.id,
            p_media_id: existing.media_id,
          })
        } catch (e) {
          console.error("Failed to recognize full-series rewatches", e)
        }
      }

      return Response.json({ success: true })
    }

    if (action === "resume_new_period") {
      // New-period-on-resume: create a fresh currently_watching period (history preserved).
      const periodId = body.period_id
      if (typeof periodId !== "string") return Response.json({ error: "period_id required" }, { status: 400 })
      const startedAt = isValidDateString(body.started_at)
        ? body.started_at
        : new Date().toISOString().slice(0, 10)

      const { data: existing, error: fetchErr } = await supabase
        .from("watch_periods")
        .select("id, user_id, media_id, media_type, season_number, status")
        .eq("id", periodId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (fetchErr || !existing) {
        return Response.json({ error: "Watch period not found" }, { status: 404 })
      }
      if (existing.status !== "stopped") {
        return Response.json({ error: "Only stopped periods can be resumed" }, { status: 400 })
      }

      const { data: period, error: periodError } = await supabase
        .from("watch_periods")
        .insert({
          user_id: user.id,
          media_id: existing.media_id,
          media_type: existing.media_type,
          season_number: existing.season_number,
          status: "currently_watching",
          started_at: startedAt,
          ended_at: null,
        })
        .select("id")
        .single()

      if (periodError || !period) {
        if (periodError?.code === "23505") {
          return Response.json({ error: "Already currently watching this title/season." }, { status: 409 })
        }
        return Response.json({ error: periodError?.message ?? "Failed to resume" }, { status: 500 })
      }

      const actErr = await insertActivity(supabase, {
        user_id: user.id,
        media_id: existing.media_id,
        period_id: period.id,
        event_type: "started",
        season_number: existing.season_number ?? null,
      })
      if (actErr) console.error("Failed to insert watch activity", actErr)

      return Response.json({ success: true, period_id: period.id })
    }

    if (action === "update_dates") {
      const periodId = body.period_id
      if (typeof periodId !== "string") return Response.json({ error: "period_id required" }, { status: 400 })
      const { data: existing, error: fetchErr } = await supabase
        .from("watch_periods")
        .select("id, user_id, status, started_at, ended_at")
        .eq("id", periodId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (fetchErr || !existing) return Response.json({ error: "Watch period not found" }, { status: 404 })

      const startedAt = isValidDateString(body.started_at) ? body.started_at : existing.started_at
      let endedAt: string | null = existing.ended_at
      if (existing.status === "currently_watching") {
        endedAt = null
      } else if (Object.prototype.hasOwnProperty.call(body, "ended_at")) {
        if (body.ended_at === null || body.ended_at === "") {
          return Response.json({ error: "End date required for completed periods" }, { status: 400 })
        }
        if (!isValidDateString(body.ended_at)) return Response.json({ error: "Invalid end date" }, { status: 400 })
        endedAt = body.ended_at
      }
      if (endedAt && endedAt < startedAt) {
        return Response.json({ error: "End date cannot be before start date" }, { status: 400 })
      }

      const { error: updateErr } = await supabase
        .from("watch_periods")
        .update({ started_at: startedAt, ended_at: endedAt })
        .eq("id", periodId)
        .eq("user_id", user.id)
      if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

      // No watch_activities emitted on date corrections (by design).
      return Response.json({ success: true })
    }

    if (action === "delete") {
      const periodId = body.period_id
      if (typeof periodId !== "string") return Response.json({ error: "period_id required" }, { status: 400 })

      // Collect watch activity ids so we can remove all feed_likes for their keys
      // (likes may belong to other users; service role required). Do this before
      // deleting the period because watch_activities cascade on period delete.
      const { data: acts, error: actsErr } = await supabase
        .from("watch_activities")
        .select("id")
        .eq("period_id", periodId)
        .eq("user_id", user.id)

      if (actsErr) return Response.json({ error: actsErr.message }, { status: 500 })

      const keys = (acts ?? []).map((a: any) => `watch:${a.id}`)
      if (keys.length > 0) {
        const { error: likesErr } = await service
          .from("feed_likes")
          .delete()
          .in("event_key", keys)
        if (likesErr) {
          console.error("Failed to clean feed likes for deleted watch activities", likesErr)
          // continue with period deletion; likes would be orphaned but harmless
        }
      }

      const { data: periodRow } = await supabase
        .from("watch_periods")
        .select("media_id, season_number")
        .eq("id", periodId)
        .eq("user_id", user.id)
        .maybeSingle()

      const { error } = await supabase
        .from("watch_periods")
        .delete()
        .eq("id", periodId)
        .eq("user_id", user.id)
      if (error) return Response.json({ error: error.message }, { status: 500 })

      // Deleting a grouped finished period dissolves its group via trigger; reconcile
      // so remaining eligible viewings can form valid groups if applicable.
      if (periodRow?.media_id && periodRow.season_number != null) {
        try {
          await supabase.rpc("reconcile_tv_full_series_rewatches", {
            p_user_id: user.id,
            p_media_id: periodRow.media_id,
          })
        } catch (e) {
          console.error("Failed to reconcile full-series rewatches after delete", e)
        }
      }

      return Response.json({ success: true })
    }

    if (action === "undo_finish") {
      const periodId = body.period_id
      if (typeof periodId !== "string") return Response.json({ error: "period_id required" }, { status: 400 })

      const { data: existing, error: fetchErr } = await supabase
        .from("watch_periods")
        .select("id, user_id, media_id, season_number, status")
        .eq("id", periodId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (fetchErr || !existing) {
        return Response.json({ error: "Watch period not found" }, { status: 404 })
      }
      if (existing.status !== "finished") {
        return Response.json({ error: "Only finished periods can be moved back to active" }, { status: 400 })
      }

      // Remove finished watch activity (and its likes) to keep feed consistent.
      const { data: acts, error: actsErr } = await supabase
        .from("watch_activities")
        .select("id")
        .eq("period_id", periodId)
        .eq("user_id", user.id)
        .eq("event_type", "finished")

      if (actsErr) return Response.json({ error: actsErr.message }, { status: 500 })

      const keys = (acts ?? []).map((a: any) => `watch:${a.id}`)
      if (keys.length > 0) {
        const { error: likesErr } = await service
          .from("feed_likes")
          .delete()
          .in("event_key", keys)
        if (likesErr) console.error("Failed to clean feed likes for undone finish", likesErr)

        const { error: delActErr } = await supabase
          .from("watch_activities")
          .delete()
          .eq("period_id", periodId)
          .eq("user_id", user.id)
          .eq("event_type", "finished")
        if (delActErr) console.error("Failed to remove finished watch activity", delActErr)
      }

      const { error: updateErr } = await supabase
        .from("watch_periods")
        .update({ status: "currently_watching", ended_at: null })
        .eq("id", periodId)
        .eq("user_id", user.id)

      if (updateErr) {
        if (updateErr.code === "23505") {
          return Response.json({ error: "Already currently watching this title/season." }, { status: 409 })
        }
        return Response.json({ error: updateErr.message }, { status: 500 })
      }

      // Undoing finish can invalidate/dissolve grouping; reconcile for consistency.
      if (existing.season_number != null) {
        try {
          await supabase.rpc("reconcile_tv_full_series_rewatches", {
            p_user_id: user.id,
            p_media_id: existing.media_id,
          })
        } catch (e) {
          console.error("Failed to reconcile full-series rewatches after undo", e)
        }
      }

      return Response.json({ success: true })
    }

    return Response.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: any) {
    console.error("Watching API error", e)
    return Response.json({ error: e?.message ?? "Internal error" }, { status: 500 })
  }
}
