import { cn } from "@/lib/utils"

export function MediaTypeBadge({
  type,
  className,
}: {
  type: string
  className?: string
}) {
  const isTv = type === "tv"
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-xs font-medium",
        isTv ? "text-sky-500 border-sky-500/30 bg-sky-500/10" : "text-rose-500 border-rose-500/30 bg-rose-500/10",
        className
      )}
    >
      {isTv ? "TV Show" : "Movie"}
    </span>
  )
}
