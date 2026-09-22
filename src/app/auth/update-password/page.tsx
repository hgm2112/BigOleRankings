"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthBlurb } from "@/components/auth-blurb"
import Link from "next/link"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login?message=Invalid or expired password reset link")
        return
      }
      setChecking(false)
    }
    checkSession()
  }, [router, supabase])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setNewPassword("")
    setConfirmPassword("")
    setSaved(true)
  }

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center py-8 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
        <AuthBlurb variant="default" />
        <div className="flex justify-center">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Set a New Password</CardTitle>
              <CardDescription>Choose a new password for your account</CardDescription>
            </CardHeader>
            <CardContent>
              {saved ? (
                <div className="space-y-4">
                  <div className="rounded-md bg-muted p-3 text-sm text-foreground">
                    Your password has been updated successfully.
                  </div>
                  <Link
                    href="/login"
                    className="block text-center text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Sign In
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
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
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={saving}>{saving ? "Updating..." : "Update Password"}</Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}