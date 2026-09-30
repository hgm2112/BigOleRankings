"use client"

import Image from "next/image"
import { Handshake, Flame, Trophy } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MediaTypeBadge } from "@/components/media-type-badge"
import { USER_1_COLOR, USER_2_COLOR } from "@/components/charts/chart-colors"
import type { ExtremesItem, TopOverlap } from "@/lib/compare-stats"
import { AgreementsHelp, FightsHelp, TopTenHelp } from "./metric-help"

function Row({ item, nameA, nameB }: { item: ExtremesItem; nameA: string; nameB: string }) {
  const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w154${item.poster_path}` : null
  const delta = item.delta
  return (
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/50">
      {posterUrl ? (
        <Image src={posterUrl} alt={item.title} width={26} height={39} quality={90} className="rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-[26px] h-[39px] rounded bg-muted flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <div className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
          <span style={{ color: USER_1_COLOR }}>
            {nameA} {item.a}
          </span>
          <span>·</span>
          <span style={{ color: USER_2_COLOR }}>
            {nameB} {item.b}
          </span>
        </div>
      </div>
      <MediaTypeBadge type={item.media_type} />
      <span
        className={`w-10 text-right text-sm font-semibold tabular-nums ${
          delta > 0 ? "text-green-600" : delta < 0 ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {delta > 0 ? `+${delta}` : delta}
      </span>
    </div>
  )
}

function ListCard({
  title,
  description,
  icon,
  iconClass,
  items,
  nameA,
  nameB,
  emptyText,
  help,
}: {
  title: string
  description: string
  icon: React.ReactNode
  iconClass: string
  items: ExtremesItem[]
  nameA: string
  nameB: string
  emptyText: string
  help?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className={`flex h-7 w-7 items-center justify-center rounded-md ${iconClass}`}>{icon}</span>
          {title}
          {help}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-0.5 pt-0">
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          items.map((item) => <Row key={item.media_id} item={item} nameA={nameA} nameB={nameB} />)
        )}
      </CardContent>
    </Card>
  )
}

export function ExtremesLists({
  agreements,
  fights,
  topOverlap,
  nameA,
  nameB,
}: {
  agreements: ExtremesItem[]
  fights: ExtremesItem[]
  topOverlap: TopOverlap
  nameA: string
  nameB: string
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <ListCard
        title="Biggest Agreements"
        description="Closest gut ratings"
        icon={<Handshake className="h-4 w-4" />}
        iconClass="bg-green-600/10 text-green-600"
        items={agreements}
        nameA={nameA}
        nameB={nameB}
        emptyText="No shared titles yet."
        help={<AgreementsHelp nameA={nameA} nameB={nameB} />}
      />
      <ListCard
        title="Biggest Fights"
        description="Widest gut gaps"
        icon={<Flame className="h-4 w-4" />}
        iconClass="bg-destructive/10 text-destructive"
        items={fights}
        nameA={nameA}
        nameB={nameB}
        emptyText="No shared titles yet."
        help={<FightsHelp nameA={nameA} nameB={nameB} />}
      />
      <ListCard
        title={`Top-10 Overlap (${topOverlap.count}/10)`}
        description="Titles both put in their personal top 10"
        icon={<Trophy className="h-4 w-4" />}
        iconClass="bg-amber-500/10 text-amber-500"
        items={topOverlap.items}
        nameA={nameA}
        nameB={nameB}
        emptyText="No overlap in your top 10s."
        help={<TopTenHelp count={topOverlap.count} nameA={nameA} nameB={nameB} />}
      />
    </div>
  )
}
