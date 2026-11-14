"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthBlurb } from "@/components/auth-blurb"
import Link from "next/link"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const emailRedirectTo =
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
        : `${window.location.origin}/auth/callback`)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.session) {
      router.push("/dashboard")
      router.refresh()
    } else {
      setPendingEmail(email)
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!pendingEmail) return
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
      email: pendingEmail,
      options: { emailRedirectTo },
    })

    if (error) {
      setResendError(error.message)
    } else {
      setResendMessage("Confirmation email resent. Please check your inbox (and spam).")
    }
    setResendLoading(false)
  }

  if (pendingEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
          <AuthBlurb variant="register" />
          <div className="flex justify-center">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle>Check your email</CardTitle>
                <CardDescription>Confirm your account to finish signing up</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to <span className="font-medium text-foreground">{pendingEmail}</span>. Click the link in that email to activate your account.
                </p>
                {resendMessage && <p className="text-sm text-green-600">{resendMessage}</p>}
                {resendError && <p className="text-sm text-destructive">{resendError}</p>}
                <Button type="button" variant="outline" className="w-full" onClick={handleResend} disabled={resendLoading}>
                  {resendLoading ? "Sending..." : "Resend confirmation email"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already confirmed? <Link href="/login" className="text-primary underline-offset-4 hover:underline">Sign In</Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
      <AuthBlurb variant="register" />
      <div className="flex justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Sign up for a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" placeholder="cooluser" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account..." : "Create Account"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="text-primary underline-offset-4 hover:underline">Sign In</Link>
          </p>
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  )
}
