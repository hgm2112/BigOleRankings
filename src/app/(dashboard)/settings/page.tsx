"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { ThemeSetter } from "@/components/theme-setter"

const themes = [
  { name: "default", label: "Default", primary: "oklch(0.5 0.22 29)" },
  { name: "ocean", label: "Ocean", primary: "oklch(0.55 0.2 240)" },
  { name: "forest", label: "Forest", primary: "oklch(0.5 0.18 150)" },
  { name: "royal", label: "Royal", primary: "oklch(0.5 0.22 280)" },
  { name: "rose", label: "Rose", primary: "oklch(0.55 0.22 10)" },
  { name: "teal", label: "Teal", primary: "oklch(0.55 0.18 190)" },
]

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentTheme, setCurrentTheme] = useState("default")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", user.id)
        .single()

      if (data?.theme) {
        setCurrentTheme(data.theme)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [supabase])

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

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ThemeSetter theme={currentTheme} />

      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Customize your experience</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">Theme</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {themes.map((theme) => {
              const isActive = currentTheme === theme.name
              return (
                <button
                  key={theme.name}
                  type="button"
                  disabled={saving}
                  onClick={() => selectTheme(theme.name)}
                  className={`relative rounded-lg border-2 p-3 text-left transition-all hover:scale-[1.02] ${
                    isActive ? "border-primary" : "border-border"
                  }`}
                >
                  <div
                    className="h-16 rounded-md mb-2"
                    style={{ backgroundColor: theme.primary }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{theme.label}</span>
                    {isActive && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
