"use client"

import { Info } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function InfoButton({
  label,
  align = "start",
  children,
}: {
  label: string
  align?: "start" | "center" | "end"
  children: React.ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What does ${label} mean?`}
          className="-m-2 inline-flex shrink-0 cursor-pointer items-center rounded-sm p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-72 max-w-[calc(100vw-2rem)] space-y-1.5 p-3 text-xs">
        {children}
      </PopoverContent>
    </Popover>
  )
}
