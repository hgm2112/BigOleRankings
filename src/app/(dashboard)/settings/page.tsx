"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [displayName, setDisplayName] = useState("")
  const [displaySaving, setDisplaySaving] = useState(false)
  const [displaySuccess, setDisplaySuccess] = useState(false)
  const [displayError, setDisplayError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Basic push notification enable (detailed rating reminders)
  const [deviceBusy, setDeviceBusy] = useState(false)
  const [enableSuccess, setEnableSuccess] = useState(false)
  const [enableError, setEnableError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single()

      if (data?.display_name) {
        setDisplayName(data.display_name)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [supabase])

  const handleDisplayNameChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setDisplayError(null)
    setDisplaySuccess(false)

    const trimmed = displayName.trim()
    if (!trimmed) {
      setDisplayError("Display name cannot be empty.")
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setDisplaySaving(true)
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", user.id)
    setDisplaySaving(false)

    if (error) {
      setDisplayError(error.message)
      return
    }

    setDisplaySuccess(true)
    router.refresh()
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

  function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const raw = window.atob(base64)
    const bytes = new Uint8Array(new ArrayBuffer(raw.length))
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i)
    }
    return bytes
  }

  async function enableOnThisDevice() {
    setDeviceBusy(true)
    setEnableError(null)
    setEnableSuccess(false)

    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setEnableError(
          permission === "denied"
            ? "Notifications are blocked. Allow them in your browser/OS settings and try again."
            : "Notification permission was not granted."
        )
        return
      }

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEnableError("This browser does not support web push notifications.")
        return
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) {
        setEnableError("Push is not configured on this build.")
        return
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const json = subscription.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setEnableError("Could not read push subscription from this device.")
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setEnableError("Not signed in.")
        return
      }

      const { error: subError } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      )

      if (subError) {
        setEnableError(subError.message)
        return
      }

      setEnableSuccess(true)
    } catch (err: any) {
      setEnableError(err?.message || "Failed to enable notifications on this device.")
    } finally {
      setDeviceBusy(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">Display Name</h2>
          <form onSubmit={handleDisplayNameChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                type="text"
                placeholder="Your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                required
              />
            </div>
            {displayError && <p className="text-sm text-destructive">{displayError}</p>}
            {displaySuccess && <p className="text-sm text-green-600">Display name updated successfully.</p>}
            <Button type="submit" disabled={displaySaving}>
              {displaySaving ? "Saving..." : "Save Display Name"}
            </Button>
          </form>
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

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">Detailed Rating Reminders</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Get a push notification ~7 days after your gut rating to add a detailed rating.
            Works best when the app is installed to your home screen.
          </p>

          <Button
            onClick={enableOnThisDevice}
            disabled={deviceBusy}
            variant="outline"
          >
            {deviceBusy ? "Enabling..." : "Enable on this device"}
          </Button>

          {enableSuccess && (
            <p className="text-sm text-green-600 mt-2">
              This device is now subscribed to detailed rating reminders.
            </p>
          )}
          {enableError && (
            <p className="text-sm text-destructive mt-2">{enableError}</p>
          )}

          <p className="text-xs text-muted-foreground mt-3">
            If you already have Big Ole Rankings installed as a PWA, remove the home screen icon and reinstall the app after enabling. This is required for push notifications to activate on existing installs.
          </p>

          {/* Test notification button - hidden by default. Remove or expose when ready. */}
          {/*
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={async () => {
              // implement test send via direct admin call or action if needed
            }}
          >
            Send test (dev)
          </Button>
          */}
        </CardContent>
      </Card>
    </div>
  )
}
