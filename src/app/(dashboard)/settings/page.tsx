"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.")
      return
    }

    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)

    if (error) {
      setPasswordError(error.message)
      return
    }

    setNewPassword("")
    setConfirmPassword("")
    setPasswordSuccess(true)
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

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            {passwordSuccess && <p className="text-sm text-green-600">Password updated successfully.</p>}
            <Button type="submit" disabled={passwordSaving}>
              {passwordSaving ? "Saving..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
