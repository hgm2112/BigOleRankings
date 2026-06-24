"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Search, Pin, PinOff, UserPlus, UserCheck, Loader2 } from "lucide-react"

interface Profile {
  id: string
  username: string | null
  display_name: string | null
}

interface Follow {
  id: string
  following_id: string
}

export default function SocialPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [following, setFollowing] = useState<Follow[]>([])
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null)
  const [followingProfiles, setFollowingProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from("profiles")
        .select("pinned_user_id")
        .eq("id", user.id)
        .single()
      setPinnedUserId(profile?.pinned_user_id ?? null)

      const { data: followsData } = await supabase
        .from("follows")
        .select("id, following_id")
        .eq("follower_id", user.id)
      const follows: Follow[] = (followsData || []) as Follow[]
      setFollowing(follows)

      if (follows && follows.length > 0) {
        const ids = follows.map((f) => f.following_id)
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", ids)
        setFollowingProfiles(profiles || [])
      }

      setLoading(false)
    }
    init()
  }, [supabase])

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearched(true)

    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .ilike("username", `%${searchQuery}%`)
      .limit(10)

    setSearchResults(((data || []) as Profile[]).filter((p) => p.id !== userId))
    setSearching(false)
  }

  const isFollowing = (profileId: string) => following.some((f) => f.following_id === profileId)

  const toggleFollow = async (targetId: string) => {
    if (isFollowing(targetId)) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId!)
        .eq("following_id", targetId)

      if (!error) {
        setFollowing((prev) => prev.filter((f) => f.following_id !== targetId))
        setFollowingProfiles((prev) => prev.filter((p) => p.id !== targetId))
        if (pinnedUserId === targetId) {
          await supabase.from("profiles").update({ pinned_user_id: null }).eq("id", userId!)
          setPinnedUserId(null)
        }
      }
    } else {
      const { data } = await supabase
        .from("follows")
        .insert({ follower_id: userId!, following_id: targetId })
        .select("id, following_id")
        .single()

      if (data) {
        setFollowing((prev) => [...prev, data])
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .eq("id", targetId)
          .single()
        if (profile) setFollowingProfiles((prev) => [...prev, profile])
      }
    }
    setSearchResults([])
    setSearchQuery("")
  }

  const togglePin = async (targetId: string) => {
    if (pinnedUserId === targetId) {
      await supabase.from("profiles").update({ pinned_user_id: null }).eq("id", userId!)
      setPinnedUserId(null)
    } else {
      await supabase.from("profiles").update({ pinned_user_id: targetId }).eq("id", userId!)
      setPinnedUserId(targetId)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Social</h1>
        <p className="text-muted-foreground">Follow users and pin them to your dashboard</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Search Users</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={searching || !searchQuery.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </form>
          {searched && searchResults.length === 0 && !searching && (
            <p className="text-sm text-muted-foreground mt-2">No users found.</p>
          )}
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {searchResults.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">{(p.display_name || p.username || "U").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{p.display_name || p.username}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={isFollowing(p.id) ? "secondary" : "outline"}
                    onClick={() => toggleFollow(p.id)}
                  >
                    {isFollowing(p.id) ? (
                      <><UserCheck className="h-3.5 w-3.5 mr-1" />Following</>
                    ) : (
                      <><UserPlus className="h-3.5 w-3.5 mr-1" />Follow</>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Following ({following.length})</CardTitle>
          <CardDescription>Pin a user to see their latest rating on your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          {followingProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">You're not following anyone yet. Search for users above.</p>
          ) : (
            <div className="space-y-1">
              {followingProfiles.map((p) => {
                const isPinned = pinnedUserId === p.id
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{(p.display_name || p.username || "U").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{p.display_name || p.username}</span>
                      {isPinned && <span className="text-xs text-primary font-medium">Pinned</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={isPinned ? "default" : "ghost"}
                        onClick={() => togglePin(p.id)}
                      >
                        {isPinned ? <PinOff className="h-3.5 w-3.5 mr-1" /> : <Pin className="h-3.5 w-3.5 mr-1" />}
                        {isPinned ? "Unpin" : "Pin"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleFollow(p.id)}>
                        Unfollow
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
