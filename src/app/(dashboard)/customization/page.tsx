"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Check } from "lucide-react"
import { ThemeSetter } from "@/components/theme-setter"
import { useCustomization } from "@/components/customization-provider"
import { mergeCustomization, DEFAULT_CUSTOMIZATION, CustomizationPrefs, BACKGROUND_OPTIONS } from "@/lib/customization"

const themes = [
  { name: "default", label: "Default", primary: "oklch(0.5 0.22 29)" },
  { name: "ocean", label: "Ocean", primary: "oklch(0.55 0.2 240)" },
  { name: "forest", label: "Forest", primary: "oklch(0.5 0.18 150)" },
  { name: "royal", label: "Royal", primary: "oklch(0.5 0.22 280)" },
  { name: "rose", label: "Rose", primary: "oklch(0.55 0.22 10)" },
  { name: "teal", label: "Teal", primary: "oklch(0.55 0.18 190)" },
  { name: "amber", label: "Amber", primary: "oklch(0.55 0.17 60)" },
  { name: "lime", label: "Lime", primary: "oklch(0.6 0.18 115)" },
  { name: "sky", label: "Sky", primary: "oklch(0.55 0.17 225)" },
  { name: "indigo", label: "Indigo", primary: "oklch(0.5 0.2 265)" },
  { name: "pink", label: "Pink", primary: "oklch(0.55 0.22 330)" },
  { name: "crimson", label: "Crimson", primary: "oklch(0.55 0.22 22)" },
  { name: "orange", label: "Orange", primary: "#FFA500" },
  { name: "slate", label: "Slate", primary: "oklch(0.55 0.04 260)" },
  { name: "stone", label: "Stone", primary: "oklch(0.55 0.1 50)" },
]

type BooleanPrefKey = "score_chips" | "media_badges" | "stat_chips" | "poster_themes"

const ACCENT_OPTIONS: { key: BooleanPrefKey; label: string; description: string }[] = [
  { key: "score_chips", label: "Colored score chips", description: "Show ratings as colored pills by score band" },
  { key: "media_badges", label: "Media type badges", description: "Color-coded Movie / TV Show tags" },
  { key: "stat_chips", label: "Colored stat icons", description: "Tinted icon chips on dashboard stats" },
  { key: "poster_themes", label: "Poster-themed entry cards", description: "Tint each entry card with colors pulled from its poster" },
]

export default function CustomizationPage() {
  const supabase = createClient()
  const { prefs, setPrefs } = useCustomization()
  const [currentTheme, setCurrentTheme] = useState("default")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("theme, customization")
        .eq("id", user.id)
        .single()

      if (data?.theme) {
        setCurrentTheme(data.theme)
      }
      setPrefs(mergeCustomization(data?.customization as Partial<CustomizationPrefs> | null | undefined))
      setLoading(false)
    }
    fetchProfile()
  }, [supabase, setPrefs])

  const selectTheme = async (name: string) => {
    if (name === currentTheme) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from("profiles")
      .update({ theme: name })
      .eq("id", user.id)

    if (!error) {
      setCurrentTheme(name)
    }
    setSaving(false)
  }

  const togglePref = async (key: BooleanPrefKey, value: boolean) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from("profiles")
      .update({ customization: next })
      .eq("id", user.id)
  }

  const selectBackground = async (key: string) => {
    if (key === prefs.background) return
    const next = { ...prefs, background: key }
    setPrefs(next)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from("profiles")
      .update({ customization: next })
      .eq("id", user.id)
  }

  const resetPrefs = async () => {
    setPrefs(DEFAULT_CUSTOMIZATION)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from("profiles")
      .update({ customization: DEFAULT_CUSTOMIZATION })
      .eq("id", user.id)
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ThemeSetter theme={currentTheme} />

      <div>
        <h1 className="text-2xl font-bold">Customization</h1>
        <p className="text-muted-foreground">Make it yours</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">Theme</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {themes.map((theme) => {
              const isActive = currentTheme === theme.name
              return (
                <button
                  key={theme.name}
                  type="button"
                  disabled={saving}
                  onClick={() => selectTheme(theme.name)}
                  className={`relative rounded-lg border-2 p-2 text-left transition-all hover:scale-[1.02] ${
                    isActive ? "border-primary" : "border-border"
                  }`}
                >
                  <div
                    className="h-10 rounded-md mb-1.5"
                    style={{ backgroundColor: theme.primary }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">{theme.label}</span>
                    {isActive && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">Background</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {BACKGROUND_OPTIONS.map((bg) => {
              const isActive = prefs.background === bg.key
              return (
                <button
                  key={bg.key}
                  type="button"
                  disabled={saving}
                  onClick={() => selectBackground(bg.key)}
                  className={`relative rounded-lg border-2 p-2 text-left transition-all hover:scale-[1.02] ${
                    isActive ? "border-primary" : "border-border"
                  }`}
                >
                  <div
                    className="h-10 rounded-md mb-1.5 border border-border/50"
                    style={{ backgroundColor: bg.color }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">{bg.label}</span>
                    {isActive && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-1">Colorful Accents</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Add pops of color across the site. Changes apply instantly.
          </p>
          <div className="space-y-4">
            {ACCENT_OPTIONS.map((option) => (
              <div key={option.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                <Switch
                  checked={prefs[option.key]}
                  onCheckedChange={(value) => togglePref(option.key, value)}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={resetPrefs}
            className="mt-5 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Reset all accents to default
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
