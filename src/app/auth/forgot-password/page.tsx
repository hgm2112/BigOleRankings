"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthBlurb } from "@/components/auth-blurb"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/update-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
        <AuthBlurb variant="default" />
        <div className="flex justify-center">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>Enter your email and we&apos;ll send you a reset link</CardDescription>
            </CardHeader>
            <CardContent>
              {sent ? (
                <div className="space-y-4">
                  <div className="rounded-md bg-muted p-3 text-sm text-foreground">
                    If an account exists for that email, we&apos;ve sent a password reset link. Check your inbox.
                  </div>
                  <Link
                    href="/login"
                    className="block text-center text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Back to Sign In
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending link..." : "Send Reset Link"}</Button>
                </form>
              )}
              {!sent && (
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Remembered it? <Link href="/login" className="text-primary underline-offset-4 hover:underline">Sign In</Link>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}