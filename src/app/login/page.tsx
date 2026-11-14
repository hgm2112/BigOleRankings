"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthBlurb } from "@/components/auth-blurb"
import Link from "next/link"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const message = searchParams.get("message")
  const showResendFromMessage = !!message && /confirm|expired|invalid/i.test(message)

  const isUnconfirmedError = (msg: string) => /email not confirmed|not confirmed/i.test(msg)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResendMessage(null)
    setResendError(null)
    setShowResend(false)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      if (isUnconfirmedError(error.message)) {
        setShowResend(true)
      }
      setLoading(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  const handleResend = async (targetEmail: string) => {
    if (!targetEmail) {
      setResendError("Enter your email address to resend the confirmation email.")
      return
    }
    setResendLoading(true)
    setResendMessage(null)
    setResendError(null)

    const supabase = createClient()
    const emailRedirectTo =
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
        : `${window.location.origin}/auth/callback`)
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: { emailRedirectTo },
    })

    if (error) {
      setResendError(error.message)
    } else {
      setResendMessage("Confirmation email resent. Please check your inbox (and spam).")
      setShowResend(false)
    }
    setResendLoading(false)
  }

  const canShowResend = showResend || showResendFromMessage

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
      <AuthBlurb variant="login" />
      <div className="flex justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Enter your email and password to sign in</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {message && (
              <div className="rounded-md bg-muted p-3 text-sm text-foreground">{message}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/forgot-password" className="text-xs text-primary underline-offset-4 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {canShowResend && (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm text-muted-foreground">
                  Need a new confirmation email?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleResend(email)}
                  disabled={resendLoading}
                >
                  {resendLoading ? "Sending..." : "Resend confirmation email"}
                </Button>
              </div>
            )}
            {resendMessage && <p className="text-sm text-green-600">{resendMessage}</p>}
            {resendError && <p className="text-sm text-destructive">{resendError}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account? <Link href="/register" className="text-primary underline-offset-4 hover:underline">Sign Up</Link>
          </p>
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
