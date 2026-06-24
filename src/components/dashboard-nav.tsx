"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { LogOut, LayoutDashboard, ListVideo, Plus, Users, Settings } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface Profile {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export function DashboardNav({ user, profile }: { user: SupabaseUser; profile: Profile | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const displayName = profile?.display_name || profile?.username || user.email?.split("@")[0] || "User"
  const initials = displayName.charAt(0).toUpperCase()

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/entries", label: "My Ratings", icon: ListVideo },
    { href: "/entries/new", label: "Add Rating", icon: Plus },
    { href: "/compare", label: "Compare", icon: Users },
  ]

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/dashboard" className="font-bold text-lg mr-6">
          BigOleRankings
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname?.startsWith(link.href + "/")
            return (
              <Button key={link.href} variant={isActive ? "secondary" : "ghost"} size="sm" asChild>
                <Link href={link.href}>
                  <Icon className="h-4 w-4 mr-1" />
                  {link.label}
                </Link>
              </Button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-1">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Separator className="my-2" />
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <Link href="/dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</Link>
                </Button>
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <Link href="/entries"><ListVideo className="h-4 w-4 mr-2" />My Ratings</Link>
                </Button>
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <Link href="/settings"><Settings className="h-4 w-4 mr-2" />Settings</Link>
                </Button>
              </div>
              <Separator className="my-2" />
              <Button variant="ghost" size="sm" className="justify-start w-full" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />Sign Out
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <nav className="md:hidden flex items-center gap-0 px-2 pb-2 overflow-x-auto">
        {navLinks.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href || pathname?.startsWith(link.href + "/")
          return (
            <Button key={link.href} variant={isActive ? "secondary" : "ghost"} size="sm" asChild className="flex-shrink-0">
              <Link href={link.href}>
                <Icon className="h-4 w-4 mr-1" />
                {link.label}
              </Link>
            </Button>
          )
        })}
      </nav>
    </header>
  )
}
