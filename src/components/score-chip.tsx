import { cn } from "@/lib/utils"

const HIGH = "text-green-600"
const MID = "text-amber-500"
const LOW = "text-red-500"

export function scoreTextClass(value: number | null | undefined, max: number): string {
  if (value == null) return ""
  const ratio = value / max
  if (ratio >= 0.8) return HIGH
  if (ratio >= 0.5) return MID
  return LOW
}

export function ScoreChip({
  value,
  max = 100,
  className,
}: {
  value: number | null | undefined
  max?: number
  className?: string
}) {
  const text = scoreTextClass(value, max)
  const bg = text === HIGH ? "bg-green-600/10" : text === MID ? "bg-amber-500/10" : "bg-red-500/10"

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        text,
        bg,
        className
      )}
    >
      {value ?? "—"}
    </span>
  )
}
