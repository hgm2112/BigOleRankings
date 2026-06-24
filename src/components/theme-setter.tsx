"use client"

import { useEffect } from "react"

const THEMES = ["default", "ocean", "forest", "royal", "rose", "teal"]

export function ThemeSetter({ theme }: { theme: string }) {
  useEffect(() => {
    const html = document.documentElement
    for (const t of THEMES) {
      html.classList.remove(`theme-${t}`)
    }
    if (theme !== "default") {
      html.classList.add(`theme-${theme}`)
    }
  }, [theme])
  return null
}
