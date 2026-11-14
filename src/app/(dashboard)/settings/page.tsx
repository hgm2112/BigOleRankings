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
  const [deviceSubscribed, setDeviceSubscribed] = useState(false)
  const [justSentTest, setJustSentTest] = useState(false)

  const [upcomingReleaseNotifications, setUpcomingReleaseNotifications] = useState(true)
  const [notifSettingsSaving, setNotifSettingsSaving] = useState(false)
  const [notifSettingsError, setNotifSettingsError] = useState<string | null>(null)
  const [notifSettingsSuccess, setNotifSettingsSuccess] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const [{ data: profile }, { data: notifSettings }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).single(),
        supabase
          .from("notification_settings")
          .select("detailed_rating_reminders, upcoming_release_notifications, timezone")
          .eq("user_id", user.id)
          .maybeSingle(),
      ])

      if (profile?.display_name) {
        setDisplayName(profile.display_name)
      }
      if (notifSettings) {
        setUpcomingReleaseNotifications(notifSettings.upcoming_release_notifications !== false)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [supabase])

  // Check if this device already has an active push subscription (for toggle button state)
  useEffect(() => {
    const checkDeviceSubscription = async () => {
      if (!("serviceWorker" in navigator)) return
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        const subscription = await registration?.pushManager.getSubscription()
        setDeviceSubscribed(!!subscription)
      } catch {
        // ignore – treat as not subscribed
      }
    }
    checkDeviceSubscription()
  }, [])

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

  async function upsertNotificationSettings(patch: { upcoming_release_notifications?: boolean; timezone?: string | null }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error("Not signed in") }
    const tz = patch.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const payload: any = {
      user_id: user.id,
      timezone: tz,
      updated_at: new Date().toISOString(),
    }
    if (typeof patch.upcoming_release_notifications === "boolean") {
      payload.upcoming_release_notifications = patch.upcoming_release_notifications
    }
    return await supabase.from("notification_settings").upsert(payload, { onConflict: "user_id" })
  }

  async function saveUpcomingReleasePreference(next: boolean) {
    setNotifSettingsSaving(true)
    setNotifSettingsError(null)
    setNotifSettingsSuccess(false)
    const prev = upcomingReleaseNotifications
    setUpcomingReleaseNotifications(next)
    const { error } = await upsertNotificationSettings({ upcoming_release_notifications: next })
    setNotifSettingsSaving(false)
    if (error) {
      setUpcomingReleaseNotifications(prev)
      setNotifSettingsError(error.message)
      return
    }
    setNotifSettingsSuccess(true)
  }

  async function enableOnThisDevice() {
    setDeviceBusy(true)
    setEnableError(null)
    setEnableSuccess(false)
    setJustSentTest(false)

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

      // Ensure fresh auth state (important for PWA after reinstall or cookie clearing)
      let { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Attempt a session refresh
        const { data: { session } } = await supabase.auth.getSession()
        user = session?.user ?? null
      }
      if (!user) {
        setEnableError("Not signed in. Log in again inside the app and retry.")
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
      setDeviceSubscribed(true)
      setJustSentTest(true)

      // Save notification timezone (for local-noon delivery) when enabling on this device.
      try {
        await upsertNotificationSettings({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      } catch {
        // best-effort
      }

      // Automatically send a test notification right after enabling
      try {
        await fetch("/api/test-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint }),
        })
      } catch {
        // Test send is best-effort; subscription was successful
      }
    } catch (err: any) {
      setEnableError(err?.message || "Failed to enable notifications on this device.")
    } finally {
      setDeviceBusy(false)
    }
  }

  async function disableOnThisDevice() {
    setDeviceBusy(true)
    setEnableError(null)
    setEnableSuccess(false)
    setJustSentTest(false)

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEnableError("This browser does not support web push notifications.")
        return
      }

      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()

      if (!subscription) {
        setDeviceSubscribed(false)
        return
      }

      const json = subscription.toJSON()
      const endpoint = json?.endpoint

      await subscription.unsubscribe()

      const { data: { user } } = await supabase.auth.getUser()
      if (user && endpoint) {
        await supabase
          .from("push_subscriptions")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("endpoint", endpoint)
          .eq("user_id", user.id)
      }

      setDeviceSubscribed(false)
    } catch (err: any) {
      setEnableError(err?.message || "Failed to disable notifications on this device.")
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
          <h2 className="font-semibold mb-4">Push Notifications</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Enable notifications on this device (recommended when the app is installed to your home screen).
            This is used for detailed rating reminders and upcoming release alerts.
          </p>

          <Button
            onClick={deviceSubscribed ? disableOnThisDevice : enableOnThisDevice}
            disabled={deviceBusy}
            variant="outline"
          >
            {deviceBusy
              ? deviceSubscribed
                ? "Disabling..."
                : "Enabling..."
              : deviceSubscribed
                ? "Disable on this device"
                : "Enable on this device"}
          </Button>

          {enableSuccess && (
            <p className="text-sm text-green-600 mt-2">
              This device is now subscribed to notifications. A test notification has been sent.
            </p>
          )}
          {enableError && (
            <p className="text-sm text-destructive mt-2">{enableError}</p>
          )}

          {justSentTest && (
            <p className="text-xs text-muted-foreground mt-3">
              A test notification titled "Successful Notification from BigOleRankings" was sent when you enabled notifications. If you didn't receive it, remove the home screen icon and reinstall the PWA.
            </p>
          )}

          <div className="mt-6 space-y-3 border-t pt-4">
            <div>
              <h3 className="font-medium">Upcoming release alerts</h3>
              <p className="text-sm text-muted-foreground">
                Get a notification around 12:00 PM in your time zone on the day a new season releases for a show on your Upcoming list.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={upcomingReleaseNotifications}
                disabled={notifSettingsSaving}
                onChange={(e) => void saveUpcomingReleasePreference(e.target.checked)}
              />
              Notify me when an upcoming season is released
            </label>
            {notifSettingsSuccess && <p className="text-sm text-green-600">Notification preference saved.</p>}
            {notifSettingsError && <p className="text-sm text-destructive">{notifSettingsError}</p>}
            <p className="text-xs text-muted-foreground">
              If your time zone isn&apos;t known, notifications are sent around 12:00 PM US Eastern.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
