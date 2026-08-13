"use client"

import { useEffect, useState } from "react"

export interface PosterPalette {
  accent: string
  wash: string
  glow: string
  chip: { text: string; bg: string }
}

const POSTER_MAX_HEIGHT = 48

const cache = new Map<string, PosterPalette>()

function toRgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [lr, lg, lb] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

function extractPalette(img: HTMLImageElement): PosterPalette {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) return buildFallback()

  const ratio = Math.min(1, POSTER_MAX_HEIGHT / Math.max(img.naturalHeight, 1))
  canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))

  let data: ImageData
  try {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  } catch {
    return buildFallback()
  }

  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>()
  const pixels = data.data
  for (let i = 0; i < pixels.length; i += 16) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (brightness < 16 || brightness > 245) continue
    const key = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.count += 1
      bucket.r += r
      bucket.g += g
      bucket.b += b
    } else {
      buckets.set(key, { count: 1, r, g, b })
    }
  }

  let best: { count: number; r: number; g: number; b: number } | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket
  }
  if (!best) return buildFallback()

  const count = Math.max(best.count, 1)
  const r = best.r / count
  const g = best.g / count
  const b = best.b / count

  return buildPalette(r, g, b)
}

function buildFallback(): PosterPalette {
  return buildPalette(128, 128, 128)
}

function buildPalette(r: number, g: number, b: number): PosterPalette {
  const lum = relativeLuminance(r, g, b)
  const chipText = lum < 0.45 ? blend(r, g, b, 255, 255, 255, 0.35) : blend(r, g, b, 0, 0, 0, 0.25)
  const [vr, vg, vb] = boostLuminance(r, g, b, 0.35)
  return {
    accent: toRgb(vr, vg, vb),
    wash: `rgb(${r} ${g} ${b} / 0.25)`,
    glow: `rgb(${vr} ${vg} ${vb} / 0.75)`,
    chip: {
      text: chipText,
      bg: `rgb(${r} ${g} ${b} / 0.15)`,
    },
  }
}

function boostLuminance(r: number, g: number, b: number, target: number): [number, number, number] {
  let [br, bg, bb] = [r, g, b]
  for (let i = 0; i < 10 && relativeLuminance(br, bg, bb) < target; i++) {
    br += (255 - br) * 0.2
    bg += (255 - bg) * 0.2
    bb += (255 - bb) * 0.2
  }
  return [br, bg, bb]
}

function blend(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, amount: number): string {
  return toRgb(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount)
}

export function usePosterTheme(posterPath: string | null | undefined, enabled: boolean): PosterPalette | null {
  const [palette, setPalette] = useState<PosterPalette | null>(() =>
    enabled && posterPath ? cache.get(posterPath) ?? null : null
  )

  useEffect(() => {
    if (!enabled || !posterPath) return
    if (cache.get(posterPath)) return

    const url = `https://image.tmdb.org/t/p/w342${posterPath}`
    let cancelled = false

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const derived = extractPalette(img)
      if (cancelled) return
      cache.set(posterPath, derived)
      if (process.env.NODE_ENV !== "production") {
        console.log("[poster-theme]", posterPath, derived.accent)
      }
      setPalette(derived)
    }
    img.onerror = () => {
      if (cancelled) return
      console.error("[poster-theme] failed to load poster", url)
      cache.set(posterPath, buildFallback())
      setPalette(buildFallback())
    }
    img.src = url

    return () => {
      cancelled = true
    }
  }, [posterPath, enabled])

  return enabled && posterPath ? palette : null
}
