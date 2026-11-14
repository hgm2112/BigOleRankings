"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TMDSearch } from "@/components/tmdb-search"
import { MediaTypeBadge } from "@/components/media-type-badge"
import { PosterLightbox } from "@/components/poster-lightbox"
import { Film, Tv, PlayCircle, Play, CheckCircle2, XCircle, PauseCircle, RotateCcw, Plus, Pencil, Calendar, Trash2, Star, MoreVertical } from "lucide-react"
import { formatDate } from "@/lib/format-date"
import { formatDuration, todayLocalDate, type WatchPeriodWithMedia } from "@/lib/watching"

interface TMDBResult {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: string
  media_type: string
  overview: string
  runtime?: number | null
}

interface TMDBDetails {
  tmdb_id: number
  title: string
  poster_path: string | null
  year: number | null
  media_type: string
  runtime: number | null
  genres?: string[]
  overview?: string
  status?: string | null
  next_air_date?: string | null
  network?: string | null
  seasons?: { season_number: number; name: string; air_year: number | null; episode_count: number }[]
}

interface FinishDialogState {
  period: WatchPeriodWithMedia
  endedAt: string
  actionType: "finished" | "dnf"
  nextSeasonAvailable: boolean
  nextSeasonNumber: number | null
  details: TMDBDetails | null
  existingSeasonRating: number | null
  existingSeasonDnf: boolean
}

function posterUrl(path: string | null, size = "w185") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null
}

function statusLabel(status: WatchPeriodWithMedia["status"]) {
  switch (status) {
    case "currently_watching": return "Currently Watching"
    case "finished": return "Finished"
    case "dnf": return "DNF"
    case "stopped": return "Paused"
  }
}

function StatusPill({ status }: { status: WatchPeriodWithMedia["status"] }) {
  const cls =
    status === "currently_watching" ? "bg-emerald-600 text-emerald-50 ring-1 ring-inset ring-emerald-300/30" :
    status === "finished" ? "bg-[#8a5b00] text-[#ffc94d] ring-1 ring-inset ring-[#ffd27a]/40" :
    status === "dnf" ? "bg-[#6b0000] text-[#ff6b6b] ring-1 ring-inset ring-[#ff8a8a]/35" :
    "bg-[#7a2e00] text-[#ff9a3d] ring-1 ring-inset ring-[#ffb066]/40"
  return <span className={`inline-flex items-center justify-center min-w-[92px] text-[12px] px-2.5 py-0.5 rounded-full font-medium ${cls}`}>{statusLabel(status)}</span>
}

function historyDateLine(startedAt: string, endedAt: string | null) {
  if (!endedAt) return formatDate(startedAt)
  const start = new Date(`${startedAt}T00:00:00`)
  const end = new Date(`${endedAt}T00:00:00`)
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start.getTime() === end.getTime()) {
    return formatDate(startedAt)
  }
  return `${formatDate(startedAt)} to ${formatDate(endedAt)}`
}

function historyDurationLine(startedAt: string, endedAt: string | null) {
  if (endedAt) {
    const start = new Date(`${startedAt}T00:00:00`)
    const end = new Date(`${endedAt}T00:00:00`)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start.getTime() === end.getTime()) {
      return "same day"
    }
  }
  return formatDuration(startedAt, endedAt)
}

function formatHistoryDate(dateStr: string) {
  return formatDate(dateStr)
}

async function apiAction(payload: any) {
  const res = await fetch("/api/watching", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Request failed")
  return data
}

export function WatchingClient({
  initialActive,
  initialHistory,
  seasonRatings = {},
}: {
  initialActive: WatchPeriodWithMedia[]
  initialHistory: WatchPeriodWithMedia[]
  seasonRatings?: Record<string, { rating: number | null; dnf: boolean }>
}) {
  const router = useRouter()
  const supabase = createClient()
  const [active, setActive] = useState(initialActive)
  const [history, setHistory] = useState(initialHistory)
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<TMDBResult | null>(null)
  const [details, setDetails] = useState<TMDBDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [seasonNumber, setSeasonNumber] = useState<string>("")
  const [startDate, setStartDate] = useState(todayLocalDate())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editDatesId, setEditDatesId] = useState<string | null>(null)
  const [editStart, setEditStart] = useState("")
  const [editEnd, setEditEnd] = useState("")
  const [endDateInputs, setEndDateInputs] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<WatchPeriodWithMedia | null>(null)
  const [finishDialog, setFinishDialog] = useState<FinishDialogState | null>(null)
  const [finishSeasonRating, setFinishSeasonRating] = useState<string>("none")
  const [nextSeasonStartDate, setNextSeasonStartDate] = useState(todayLocalDate())
  const [finishBusy, setFinishBusy] = useState<string | null>(null)
  const [ratingEditTarget, setRatingEditTarget] = useState<WatchPeriodWithMedia | null>(null)
  const [ratingEditValue, setRatingEditValue] = useState<string>("none")
  const [ratingEditBusy, setRatingEditBusy] = useState(false)

  useEffect(() => { setActive(initialActive) }, [initialActive])
  useEffect(() => { setHistory(initialHistory) }, [initialHistory])

  const refresh = () => router.refresh()

  const onSelect = async (item: TMDBResult) => {
    setSelected(item)
    setDetails(null)
    setSeasonNumber("")
    setError(null)
    setDetailsLoading(true)
    try {
      const res = await fetch(`/api/tmdb/details?id=${item.tmdb_id}&type=${item.media_type}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load details")
      setDetails(data)
      if (data.media_type === "tv" && Array.isArray(data.seasons) && data.seasons.length > 0) {
        setSeasonNumber(String(data.seasons[0].season_number))
      }
    } catch (e: any) {
      setError(e.message || "Failed to load details")
    } finally {
      setDetailsLoading(false)
    }
  }

  const startWatching = async () => {
    if (!details) return
    if (details.media_type === "tv" && !seasonNumber) {
      setError("Select a season to watch")
      return
    }
    setBusy("start")
    setError(null)
    try {
      await apiAction({
        action: "start",
        tmdb_id: details.tmdb_id,
        media_type: details.media_type,
        title: details.title,
        poster_path: details.poster_path,
        year: details.year,
        runtime: details.runtime,
        genres: details.genres,
        status: details.status,
        next_air_date: details.next_air_date,
        network: details.network,
        seasons: details.seasons,
        season_number: details.media_type === "tv" ? Number(seasonNumber) : undefined,
        started_at: startDate,
      })
      setAddOpen(false)
      setSelected(null)
      setDetails(null)
      setStartDate(todayLocalDate())
      refresh()
    } catch (e: any) {
      setError(e.message || "Failed to start watching")
    } finally {
      setBusy(null)
    }
  }

  const saveSeasonRatingIfAny = async (
    mediaId: string,
    seasonNum: number,
    markDnf = false,
    opts?: { watchPeriodId?: string; prevRating?: number | null; prevDnf?: boolean }
  ) => {
    if (finishSeasonRating === "keep" || finishSeasonRating === "none") return
    const rating = Number(finishSeasonRating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const prevRating = opts?.prevRating ?? null
    const prevDnf = opts?.prevDnf ?? false
    const newRating = rating
    const newDnf = markDnf
    const changed = prevRating !== newRating || prevDnf !== newDnf

    const { error: srErr } = await supabase.from("season_ratings").upsert(
      { user_id: user.id, media_id: mediaId, season_number: seasonNum, rating: newRating, dnf: newDnf },
      { onConflict: "user_id,media_id,season_number" }
    )
    if (srErr) throw new Error(srErr.message)

    if (newDnf === true) {
      try {
        const res = await fetch("/api/season-ratings/sync-dnf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_id: mediaId, season_numbers: [seasonNum] }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.error("Failed to sync DNF to watch period", { status: res.status, body })
        }
      } catch (e) {
        console.error("Failed to sync DNF to watch period", e)
      }
    }

    if (changed) {
      try {
        await supabase.from("rating_history").insert({
          user_id: user.id,
          media_id: mediaId,
          season_number: seasonNum,
          rating_scope: "tv_season",
          rating_kind: "season",
          prev_season_rating: prevRating,
          prev_season_dnf: prevDnf,
          new_season_rating: newRating,
          new_season_dnf: newDnf,
          watch_period_id: opts?.watchPeriodId ?? null,
          source: "watch_finish",
        })
      } catch (e) {
        console.error("Failed to record season rating history", e)
      }
    }
  }

  const resolveShowRatingHref = async (mediaId: string, tmdbId: number, mediaType: "movie" | "tv", title: string, year: number | null, posterPath: string | null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const returnTo = "/watching"
    const { data: existing } = await supabase
      .from("ratings")
      .select("id")
      .eq("user_id", user.id)
      .eq("media_id", mediaId)
      .maybeSingle()
    if (existing?.id) return `/entries/${existing.id}/edit?returnTo=${encodeURIComponent(returnTo)}`
    const params = new URLSearchParams({
      tmdb_id: String(tmdbId),
      media_type: mediaType,
      title,
      year: year != null ? String(year) : "",
      poster_path: posterPath ?? "",
      returnTo,
    })
    return `/entries/new?${params.toString()}`
  }

  const openFinishDialogForTv = async (p: WatchPeriodWithMedia, endedAt: string, actionType: "finished" | "dnf" = "finished") => {
    setFinishBusy("loading")
    setError(null)
    try {
      const currentSeason = p.season_number ?? 1
      const [seasonsRes, detailsRes] = await Promise.all([
        supabase.from("seasons").select("season_number").eq("media_id", p.media_id),
        fetch(`/api/tmdb/details?id=${p.media.tmdb_id}&type=tv`),
      ])
      const seasonNums = new Set<number>((seasonsRes.data ?? []).map((s: any) => s.season_number))
      let tmdbDetails: TMDBDetails | null = null
      if (detailsRes.ok) {
        tmdbDetails = await detailsRes.json()
        for (const s of tmdbDetails?.seasons ?? []) seasonNums.add(s.season_number)
      }
      const nextSeasonNumber = currentSeason + 1
      const nextSeasonAvailable = seasonNums.has(nextSeasonNumber)
      const sr = seasonRatings[`${p.media_id}:${currentSeason}`]
      const hasExistingSeasonRating = sr != null && (sr.rating != null || sr.dnf)
      setFinishSeasonRating(hasExistingSeasonRating ? "keep" : "none")
      setNextSeasonStartDate(todayLocalDate())
      setFinishDialog({
        period: p,
        endedAt,
        actionType,
        nextSeasonAvailable,
        nextSeasonNumber: nextSeasonAvailable ? nextSeasonNumber : null,
        details: tmdbDetails,
        existingSeasonRating: sr?.rating ?? null,
        existingSeasonDnf: sr?.dnf ?? false,
      })
    } catch (e: any) {
      setError(e.message || "Failed to prepare options")
    } finally {
      setFinishBusy(null)
    }
  }

  const openFinishDialogForMovie = (p: WatchPeriodWithMedia, endedAt: string, actionType: "finished" | "dnf" = "dnf") => {
    setFinishSeasonRating("none")
    setNextSeasonStartDate(todayLocalDate())
    setFinishDialog({
      period: p,
      endedAt,
      actionType,
      nextSeasonAvailable: false,
      nextSeasonNumber: null,
      details: null,
      existingSeasonRating: null,
      existingSeasonDnf: false,
    })
  }

  const transition = async (p: WatchPeriodWithMedia, status: "finished" | "dnf" | "stopped") => {
    const ended_at = endDateInputs[p.id] || todayLocalDate()
    setError(null)

    // Defer committing TV season finish/DNF until dialog is confirmed/cancelled.
    if ((status === "finished" || status === "dnf") && p.media_type === "tv" && p.season_number != null) {
      await openFinishDialogForTv(p, ended_at, status)
      return
    }
    // Allow optional rating flow for movies on finish/DNF.
    if ((status === "finished" || status === "dnf") && p.media_type === "movie") {
      openFinishDialogForMovie(p, ended_at, status)
      return
    }

    setBusy(p.id + status)
    try {
      await apiAction({ action: "transition", period_id: p.id, status, ended_at })
      refresh()
    } catch (e: any) {
      setError(e.message || "Failed to update")
    } finally {
      setBusy(null)
    }
  }

  const commitTransition = async (periodId: string, endedAt: string, status: "finished" | "dnf") => {
    await apiAction({ action: "transition", period_id: periodId, status, ended_at: endedAt })
  }

  const closeFinishDialog = (shouldRefresh = true) => {
    setFinishDialog(null)
    setFinishSeasonRating("none")
    setNextSeasonStartDate(todayLocalDate())
    if (shouldRefresh) refresh()
  }

  const handleFinishSave = async () => {
    if (!finishDialog) return
    setFinishBusy("save")
    setError(null)
    try {
      await commitTransition(finishDialog.period.id, finishDialog.endedAt, finishDialog.actionType)
      if (finishDialog.period.season_number != null) {
        await saveSeasonRatingIfAny(
          finishDialog.period.media_id,
          finishDialog.period.season_number,
          finishDialog.actionType === "dnf",
          {
            watchPeriodId: finishDialog.period.id,
            prevRating: finishDialog.existingSeasonRating,
            prevDnf: finishDialog.existingSeasonDnf,
          }
        )
      }
      closeFinishDialog(true)
    } catch (e: any) {
      setError(e.message || (finishDialog.actionType === "dnf" ? "Failed to mark DNF" : "Failed to finish season"))
    } finally {
      setFinishBusy(null)
    }
  }

  const handleFinishRateShow = async () => {
    if (!finishDialog) return
    setFinishBusy("rate")
    setError(null)
    try {
      await commitTransition(finishDialog.period.id, finishDialog.endedAt, finishDialog.actionType)
      if (finishDialog.period.season_number != null) {
        await saveSeasonRatingIfAny(
          finishDialog.period.media_id,
          finishDialog.period.season_number,
          finishDialog.actionType === "dnf",
          {
            watchPeriodId: finishDialog.period.id,
            prevRating: finishDialog.existingSeasonRating,
            prevDnf: finishDialog.existingSeasonDnf,
          }
        )
      }
      const href = await resolveShowRatingHref(
        finishDialog.period.media_id,
        finishDialog.period.media.tmdb_id,
        finishDialog.period.media_type,
        finishDialog.period.media.title,
        finishDialog.period.media.year,
        finishDialog.period.media.poster_path
      )
      setFinishDialog(null)
      if (href) router.push(href)
      else refresh()
    } catch (e: any) {
      setError(e.message || "Failed to continue to rating")
    } finally {
      setFinishBusy(null)
    }
  }

  const handleFinishSaveAndWatchNext = async () => {
    if (!finishDialog || !finishDialog.nextSeasonNumber) return
    setFinishBusy("next")
    setError(null)
    try {
      await commitTransition(finishDialog.period.id, finishDialog.endedAt, finishDialog.actionType)
      if (finishDialog.period.season_number != null) {
        await saveSeasonRatingIfAny(
          finishDialog.period.media_id,
          finishDialog.period.season_number,
          finishDialog.actionType === "dnf",
          {
            watchPeriodId: finishDialog.period.id,
            prevRating: finishDialog.existingSeasonRating,
            prevDnf: finishDialog.existingSeasonDnf,
          }
        )
      }
      const d = finishDialog.details
      await apiAction({
        action: "start",
        tmdb_id: finishDialog.period.media.tmdb_id,
        media_type: "tv",
        title: d?.title ?? finishDialog.period.media.title,
        poster_path: d?.poster_path ?? finishDialog.period.media.poster_path,
        year: d?.year ?? finishDialog.period.media.year,
        runtime: d?.runtime ?? null,
        genres: d?.genres ?? [],
        status: d?.status ?? null,
        next_air_date: d?.next_air_date ?? null,
        network: d?.network ?? null,
        seasons: d?.seasons ?? [{ season_number: finishDialog.nextSeasonNumber, name: `Season ${finishDialog.nextSeasonNumber}`, air_year: null, episode_count: 0 }],
        season_number: finishDialog.nextSeasonNumber,
        started_at: nextSeasonStartDate || todayLocalDate(),
      })
      closeFinishDialog(true)
    } catch (e: any) {
      setError(e.message || "Failed to start next season")
    } finally {
      setFinishBusy(null)
    }
  }

  const resumeNew = async (periodId: string) => {
    setBusy(periodId + "resume")
    setError(null)
    try {
      await apiAction({ action: "resume_new_period", period_id: periodId, started_at: todayLocalDate() })
      refresh()
    } catch (e: any) {
      setError(e.message || "Failed to resume")
    } finally {
      setBusy(null)
    }
  }

  const saveDates = async (p: WatchPeriodWithMedia) => {
    setBusy(p.id + "dates")
    setError(null)
    try {
      await apiAction({
        action: "update_dates",
        period_id: p.id,
        started_at: editStart,
        ...(p.status !== "currently_watching" ? { ended_at: editEnd } : {}),
      })
      setEditDatesId(null)
      refresh()
    } catch (e: any) {
      setError(e.message || "Failed to save dates")
    } finally {
      setBusy(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(deleteTarget.id + "delete")
    setError(null)
    try {
      await apiAction({ action: "delete", period_id: deleteTarget.id })
      setDeleteTarget(null)
      refresh()
    } catch (e: any) {
      setError(e.message || "Failed to delete")
    } finally {
      setBusy(null)
    }
  }

  const openRatingEdit = (p: WatchPeriodWithMedia) => {
    if (p.media_type === "tv" && p.season_number != null) {
      const sr = seasonRatings[`${p.media_id}:${p.season_number}`]
      setRatingEditValue(sr?.rating != null ? String(sr.rating) : "none")
    } else {
      setRatingEditValue("none")
    }
    setRatingEditTarget(p)
  }

  const saveRatingEdit = async () => {
    if (!ratingEditTarget) return
    setRatingEditBusy(true)
    setError(null)
    try {
      const p = ratingEditTarget
      if (p.media_type === "tv" && p.season_number != null) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")
        const key = `${p.media_id}:${p.season_number}`
        const existing = seasonRatings[key]
        const prevRating = existing?.rating ?? null
        const prevDnf = existing?.dnf ?? false
        const dnfFlag = existing?.dnf ?? (p.status === "dnf")

        if (ratingEditValue === "none") {
          if (existing && (existing.rating != null || existing.dnf)) {
            const { error: delErr } = await supabase
              .from("season_ratings")
              .delete()
              .eq("user_id", user.id)
              .eq("media_id", p.media_id)
              .eq("season_number", p.season_number)
            if (delErr) throw new Error(delErr.message)
            try {
              await supabase.from("rating_history").insert({
                user_id: user.id,
                media_id: p.media_id,
                season_number: p.season_number,
                rating_scope: "tv_season",
                rating_kind: "season",
                prev_season_rating: prevRating,
                prev_season_dnf: prevDnf,
                new_season_rating: null,
                new_season_dnf: false,
                source: "watching_history_edit",
              })
            } catch (e) {
              console.error("Failed to record season rating history", e)
            }
          }
        } else {
          const rating = Number(ratingEditValue)
          if (!Number.isInteger(rating) || rating < 1 || rating > 10) throw new Error("Invalid rating")
          const newRating = rating
          const newDnf = dnfFlag
          const changed = !existing || prevRating !== newRating || prevDnf !== newDnf
          const { error: upErr } = await supabase.from("season_ratings").upsert(
            { user_id: user.id, media_id: p.media_id, season_number: p.season_number, rating: newRating, dnf: newDnf },
            { onConflict: "user_id,media_id,season_number" }
          )
          if (upErr) throw new Error(upErr.message)
          if (newDnf === true) {
            try {
              const res = await fetch("/api/season-ratings/sync-dnf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ media_id: p.media_id, season_numbers: [p.season_number] }),
              })
              if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                console.error("Failed to sync DNF to watch period", { status: res.status, body })
              }
            } catch (e) {
              console.error("Failed to sync DNF to watch period", e)
            }
          }
          if (changed) {
            try {
              await supabase.from("rating_history").insert({
                user_id: user.id,
                media_id: p.media_id,
                season_number: p.season_number,
                rating_scope: "tv_season",
                rating_kind: "season",
                prev_season_rating: prevRating,
                prev_season_dnf: prevDnf,
                new_season_rating: newRating,
                new_season_dnf: newDnf,
                source: "watching_history_edit",
              })
            } catch (e) {
              console.error("Failed to record season rating history", e)
            }
          }
        }
        setRatingEditTarget(null)
        refresh()
      }
    } catch (e: any) {
      setError(e.message || "Failed to save rating")
    } finally {
      setRatingEditBusy(false)
    }
  }

  const editMovieRating = async (p: WatchPeriodWithMedia) => {
    setBusy(p.id + "rate")
    setError(null)
    try {
      const href = await resolveShowRatingHref(
        p.media_id,
        p.media.tmdb_id,
        p.media_type,
        p.media.title,
        p.media.year,
        p.media.poster_path
      )
      if (href) router.push(href)
    } catch (e: any) {
      setError(e.message || "Failed to open rating")
    } finally {
      setBusy(null)
    }
  }

  const undoFinish = async (periodId: string) => {
    setBusy(periodId + "undo")
    setError(null)
    try {
      await apiAction({ action: "undo_finish", period_id: periodId })
      refresh()
    } catch (e: any) {
      setError(e.message || "Failed to move back to active")
    } finally {
      setBusy(null)
    }
  }

  const activeEmpty = active.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><PlayCircle className="h-6 w-6" />Currently Watching</h1>
          <p className="text-muted-foreground">Track what you&apos;re watching now and your watch history.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setSelected(null); setDetails(null); setError(null) } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />Add to Watching</Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100%-2rem)] sm:w-fit sm:min-w-[22rem] sm:max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add to Currently Watching</DialogTitle>
            </DialogHeader>
            {!selected ? (
              <TMDSearch onSelect={onSelect} selectionMode="watching" />
            ) : (
              <div className="space-y-4">
                <div className="flex gap-3">
                  {posterUrl(selected.poster_path) ? (
                    <PosterLightbox posterPath={selected.poster_path} alt={selected.title} className="block rounded overflow-hidden flex-shrink-0">
                      <Image src={posterUrl(selected.poster_path)!} alt={selected.title} width={64} height={96} className="rounded object-cover" />
                    </PosterLightbox>
                  ) : (
                    <div className="w-16 h-24 rounded bg-muted flex items-center justify-center">{selected.media_type === "tv" ? <Tv className="h-5 w-5" /> : <Film className="h-5 w-5" />}</div>
                  )}
                  <div>
                    <p className="font-semibold">{selected.title}</p>
                    <p className="text-sm text-muted-foreground">{selected.year} · {selected.media_type === "tv" ? "TV Show" : "Movie"}</p>
                    <Button variant="link" className="px-0 h-auto text-xs" onClick={() => { setSelected(null); setDetails(null) }}>Choose different title</Button>
                  </div>
                </div>
                {detailsLoading && <p className="text-sm text-muted-foreground">Loading details...</p>}
                {details && (
                  <div className="space-y-3">
                    {details.media_type === "tv" && (
                      <div className="space-y-1">
                        <Label>Season</Label>
                        {details.seasons && details.seasons.length > 0 ? (
                          <Select value={seasonNumber} onValueChange={setSeasonNumber}>
                            <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                            <SelectContent>
                              {details.seasons.map((s) => (
                                <SelectItem key={s.season_number} value={String(s.season_number)}>
                                  {s.name || `Season ${s.season_number}`} {s.air_year ? `(${s.air_year})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-muted-foreground">No released season data available for this show yet.</p>
                        )}
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label htmlFor="start-date">Date started</Label>
                      <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="flex justify-center">
                      <Button onClick={startWatching} disabled={busy === "start" || (details.media_type === "tv" && (!details.seasons || details.seasons.length === 0))}>
                        {busy === "start" ? "Starting..." : "Start Watching"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </DialogContent>
        </Dialog>
      </div>

      {error && !addOpen && !finishDialog && !deleteTarget && <p className="text-sm text-destructive">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Active</h2>
        {activeEmpty ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">You&apos;re not currently watching anything. Add a movie or TV season to start tracking.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((p) => {
              const url = posterUrl(p.media.poster_path)
              const endVal = endDateInputs[p.id] || todayLocalDate()
              const finishing = busy === p.id + "finished" || (finishBusy === "loading")
              const line3 = p.media.media_type === "tv"
                ? `Season ${p.season_number}${p.media.year ? ` • ${p.media.year}` : ""}`
                : (p.media.year ? `${p.media.year}` : "")
              return (
                <Card key={p.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-stretch gap-3">
                      {url ? (
                        <PosterLightbox posterPath={p.media.poster_path} alt={p.media.title} className="block rounded overflow-hidden flex-shrink-0">
                          <div className="relative w-20 h-30 bg-muted">
                            <Image src={url} alt={p.media.title} fill sizes="80px" className="object-cover" />
                          </div>
                        </PosterLightbox>
                      ) : (
                        <div className="w-20 h-30 rounded bg-muted flex items-center justify-center flex-shrink-0">{p.media.media_type === "tv" ? <Tv className="h-5 w-5" /> : <Film className="h-5 w-5" />}</div>
                      )}
                      <div className="flex-1 min-w-0 pr-3 sm:pr-0">
                        <p className="font-semibold truncate leading-tight">{p.media.title}</p>
                        <div className="mt-0.5"><MediaTypeBadge type={p.media.media_type} /></div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-sm text-muted-foreground truncate">{line3 || "—"}</p>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-xs text-muted-foreground">Started {formatDate(p.started_at)}</p>
                          {editDatesId !== p.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 shrink-0"
                              aria-label="Edit dates"
                              title="Edit dates"
                              onClick={() => { setEditDatesId(p.id); setEditStart(p.started_at); setEditEnd(p.ended_at || "") }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {editDatesId === p.id && (
                          <div className="flex items-end gap-2 flex-wrap pt-1">
                            <div>
                              <Label className="text-xs">Start</Label>
                              <Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="h-8" />
                            </div>
                            <Button size="sm" onClick={() => saveDates(p)} disabled={busy === p.id + "dates"}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditDatesId(null)}>Cancel</Button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1 pr-2 sm:pr-0">
                          <Label className="text-xs whitespace-nowrap text-muted-foreground">
                            <span className="sm:hidden">Stop date</span>
                            <span className="hidden sm:inline">End/stop date</span>
                          </Label>
                          <Input type="date" value={endVal} onChange={(e) => setEndDateInputs((s) => ({ ...s, [p.id]: e.target.value }))} className="h-7 w-full max-w-[9.5rem] text-xs py-0" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 border-t pt-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button size="sm" variant="secondary" className="px-2 bg-green-600 text-white hover:bg-green-700 border-transparent" onClick={() => transition(p, "finished")} disabled={!!busy || !!finishBusy}><CheckCircle2 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{finishing ? "Finishing..." : "Finish"}</span></Button>
                        <Button size="sm" variant="outline" className="px-2" onClick={() => transition(p, "stopped")} disabled={!!busy || !!finishBusy}><PauseCircle className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Pause</span></Button>
                        <Button size="sm" variant="destructive" className="px-2" onClick={() => transition(p, "dnf")} disabled={!!busy || !!finishBusy}><XCircle className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">DNF</span></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">History</h2>
        {history.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-muted-foreground">No watch history yet.</CardContent></Card>
        ) : (
          <>
            {(() => {
              const renderKebab = (p: WatchPeriodWithMedia) => {
                const canResume = p.status === "stopped"
                const canUndoFinish = p.status === "finished"
                const canEditMovieRating = p.status === "finished" && p.media.media_type === "movie"
                const canEditSeasonRating = p.media.media_type === "tv" && p.season_number != null && (p.status === "finished" || p.status === "dnf")
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 sm:h-8 sm:w-8 shrink-0 -mr-1 -mt-1"
                        aria-label="More actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-48 p-1">
                      <div className="flex flex-col">
                        {canUndoFinish && (
                          <PopoverClose asChild>
                            <button
                              type="button"
                              className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                              onClick={() => {
                                if (confirm("Move this finished period back to Currently Watching? This will remove its finished activity from the social feed.")) {
                                  undoFinish(p.id)
                                }
                              }}
                              disabled={!!busy}
                            >
                              Move back to Active
                            </button>
                          </PopoverClose>
                        )}
                        {canResume && (
                          <PopoverClose asChild>
                            <button
                              type="button"
                              className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                              onClick={() => resumeNew(p.id)}
                              disabled={!!busy}
                            >
                              Resume (new period)
                            </button>
                          </PopoverClose>
                        )}
                        {canEditSeasonRating && (
                          <PopoverClose asChild>
                            <button
                              type="button"
                              className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                              onClick={() => openRatingEdit(p)}
                              disabled={!!busy}
                            >
                              Edit rating
                            </button>
                          </PopoverClose>
                        )}
                        {canEditMovieRating && (
                          <PopoverClose asChild>
                            <button
                              type="button"
                              className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                              onClick={() => editMovieRating(p)}
                              disabled={!!busy}
                            >
                              Edit rating
                            </button>
                          </PopoverClose>
                        )}
                        <PopoverClose asChild>
                          <button
                            type="button"
                            className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                            onClick={() => { setEditDatesId(p.id); setEditStart(p.started_at); setEditEnd(p.ended_at || "") }}
                          >
                            Edit dates
                          </button>
                        </PopoverClose>
                        <PopoverClose asChild>
                          <button
                            type="button"
                            className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-destructive"
                            onClick={() => setDeleteTarget(p)}
                            disabled={!!busy}
                          >
                            Delete
                          </button>
                        </PopoverClose>
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              }

              const renderEdit = (p: WatchPeriodWithMedia) => (
                editDatesId === p.id ? (
                  <div className="flex items-end gap-2 flex-wrap pt-2">
                    <div><Label className="text-xs">Start</Label><Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="h-8" /></div>
                    <div><Label className="text-xs">End</Label><Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="h-8" /></div>
                    <Button size="sm" onClick={() => saveDates(p)} disabled={busy === p.id + "dates"}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditDatesId(null)}>Cancel</Button>
                  </div>
                ) : null
              )

              const getSeasonRating = (p: WatchPeriodWithMedia) => {
                if (p.media_type !== "tv" || p.season_number == null) return null
                const sr = seasonRatings[`${p.media_id}:${p.season_number}`]
                if (!sr || sr.rating == null) return null
                return sr.rating
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {history.map((p) => {
                    const url = posterUrl(p.media.poster_path, "w185")
                    const seasonLabel = p.media.media_type === "tv" ? `Season ${p.season_number}` : "Movie"
                    const rating = getSeasonRating(p)
                    const rightColor =
                      p.status === "finished" ? "text-[#ffc94d]" :
                      p.status === "dnf" ? "text-[#b91c1c]" :
                      "text-[#ff9a3d]"
                    return (
                      <Card key={p.id} className={`rounded-[10px] border-2 border-[#3f3a5d] ${editDatesId === p.id ? "min-h-[141px]" : "h-[141px]"}`}>
                        <CardContent className="p-[10px] h-full">
                          <div className="flex gap-3 h-full">
                            {url ? (
                              <PosterLightbox posterPath={p.media.poster_path} alt={p.media.title} className="block rounded overflow-hidden flex-shrink-0">
                                <div className="relative w-20 h-30 bg-muted">
                                  <Image src={url} alt={p.media.title} fill sizes="80px" className="object-cover" />
                                </div>
                              </PosterLightbox>
                            ) : (
                              <div className="w-20 h-30 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                {p.media.media_type === "tv" ? <Tv className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                              </div>
                            )}
                            <div className="flex-1 min-w-0 flex flex-col h-30">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-base leading-tight truncate flex-1 min-w-0 text-foreground">{p.media.title}</p>
                                {renderKebab(p)}
                              </div>
                              <p className="text-[13px] font-semibold text-foreground leading-tight -mt-1">{seasonLabel}</p>
                              <p className="text-[13px] text-[#7f7f7f] mt-2 leading-tight">{historyDateLine(p.started_at, p.ended_at)}</p>
                              <p className="text-[13px] text-[#7f7f7f] leading-tight">{historyDurationLine(p.started_at, p.ended_at)}</p>
                              <div className="flex items-center justify-between gap-2 mt-auto">
                                <StatusPill status={p.status} />
                                {p.status === "stopped" ? (
                                  <button
                                    type="button"
                                    onClick={() => resumeNew(p.id)}
                                    disabled={!!busy}
                                    aria-label="Resume watching"
                                    title="Resume watching"
                                    className="inline-flex items-center justify-center h-8 w-8 text-[#ff9a3d] hover:opacity-80 disabled:opacity-50"
                                  >
                                    <Play className="h-[18px] w-[18px] fill-current" />
                                  </button>
                                ) : rating != null ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Star className={`h-[18px] w-[18px] fill-current ${rightColor}`} />
                                    <span className="text-[16px] leading-none font-medium text-foreground">{rating}/10</span>
                                  </span>
                                ) : (
                                  <span />
                                )}
                              </div>
                              {editDatesId === p.id && renderEdit(p)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )
            })()}
          </>
        )}
      </section>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete watch record?</DialogTitle>
            <DialogDescription>
              This will remove this single watching period
              {deleteTarget ? ` (${deleteTarget.media.title}${deleteTarget.media_type === "tv" ? `, Season ${deleteTarget.season_number}` : ""})` : ""}
              {" "}and its related social activity. Other watch history for this title will be preserved. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {error && deleteTarget && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={!!busy}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={!!busy}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit rating dialog */}
      <Dialog open={!!ratingEditTarget} onOpenChange={(o) => { if (!o && !ratingEditBusy) setRatingEditTarget(null) }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit rating</DialogTitle>
            <DialogDescription>
              {ratingEditTarget
                ? ratingEditTarget.media_type === "tv"
                  ? `${ratingEditTarget.media.title} — Season ${ratingEditTarget.season_number}`
                  : ratingEditTarget.media.title
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Rating (optional)</Label>
              <Select value={ratingEditValue} onValueChange={setRatingEditValue}>
                <SelectTrigger><SelectValue placeholder="No rating" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No rating</SelectItem>
                  {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} / 10</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && ratingEditTarget && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRatingEditTarget(null)} disabled={ratingEditBusy}>Cancel</Button>
            <Button onClick={saveRatingEdit} disabled={ratingEditBusy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish/DNF dialog */}
      <Dialog open={!!finishDialog} onOpenChange={(o) => { if (!o && !finishBusy) closeFinishDialog(false) }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Star className="h-4 w-4" />{finishDialog?.period.media_type === "movie" ? (finishDialog.actionType === "dnf" ? "Mark movie as DNF" : "Movie finished") : (finishDialog?.actionType === "dnf" ? "Mark as DNF" : "Season finished")}</DialogTitle>
            <DialogDescription>
              {finishDialog
                ? finishDialog.period.media_type === "tv"
                  ? `${finishDialog.period.media.title} — Season ${finishDialog.period.season_number}. Choose how to handle the season rating for this completed viewing.`
                  : `${finishDialog.period.media.title}. Choose how to handle your rating for this completed viewing.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {finishDialog && (
            <div className="space-y-4">
              {finishDialog.period.media_type === "tv" && finishDialog.period.season_number != null && (
                <div className="space-y-1">
                  <Label>Season rating</Label>
                  <Select value={finishSeasonRating} onValueChange={setFinishSeasonRating}>
                    <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                    <SelectContent>
                      {(finishDialog.existingSeasonRating != null || finishDialog.existingSeasonDnf) && (
                        <SelectItem value="keep">
                          Keep previous rating{finishDialog.existingSeasonRating != null ? ` (${finishDialog.existingSeasonRating}/10)` : finishDialog.existingSeasonDnf ? " (DNF)" : ""}
                        </SelectItem>
                      )}
                      <SelectItem value="none">Skip rating</SelectItem>
                      {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} / 10</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Keep previous leaves your current season rating unchanged. Skip doesn&apos;t change it. Picking a score submits/updates it.
                  </p>
                </div>
              )}
              {finishDialog.nextSeasonAvailable && (
                <div className="space-y-1">
                  <Label htmlFor="next-start">Next season start date (Season {finishDialog.nextSeasonNumber})</Label>
                  <Input id="next-start" type="date" value={nextSeasonStartDate} onChange={(e) => setNextSeasonStartDate(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Used only if you choose “Save &amp; Watch Next Season”.</p>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
          <div className="flex flex-col gap-2 mt-2">
            {finishDialog?.period.media_type === "movie" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full" onClick={handleFinishSave} disabled={!!finishBusy}>Keep previous rating</Button>
                  <Button variant="outline" className="w-full" onClick={handleFinishSave} disabled={!!finishBusy}>Skip rating</Button>
                </div>
                <Button variant="secondary" className="w-full" onClick={handleFinishRateShow} disabled={!!finishBusy}>Submit new rating</Button>
                <p className="text-xs text-muted-foreground text-center">“Keep previous” and “Skip” won’t change your rating. “Submit new rating” opens the rating flow.</p>
                <Button variant="ghost" size="sm" className="w-full sm:w-auto sm:self-center" onClick={() => closeFinishDialog(false)} disabled={!!finishBusy}>
                  Cancel
                </Button>
              </>
            ) : finishDialog?.nextSeasonAvailable ? (
              <>
                <Button className="w-full" onClick={handleFinishSaveAndWatchNext} disabled={!!finishBusy}>
                  Save &amp; Watch Next Season
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="w-full" onClick={handleFinishSave} disabled={!!finishBusy}>Save</Button>
                  <Button variant="secondary" className="w-full" onClick={handleFinishRateShow} disabled={!!finishBusy}>Rate show</Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full sm:w-auto sm:self-center" onClick={() => closeFinishDialog(false)} disabled={!!finishBusy}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full" onClick={handleFinishSave} disabled={!!finishBusy}>Save</Button>
                  <Button variant="secondary" className="w-full" onClick={handleFinishRateShow} disabled={!!finishBusy}>Rate show</Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full sm:w-auto sm:self-center" onClick={() => closeFinishDialog(false)} disabled={!!finishBusy}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
