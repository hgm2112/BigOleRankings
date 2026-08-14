import { cn } from "@/lib/utils"

const HIGH = "text-green-600"
const MID = "text-amber-500"
const LOW = "text-red-500"

export function scoreTextClass(
  value: number | null | undefined,
  max: number,
  thresholds?: { green: number; amber: number },
): string {
  if (value == null) return ""
  if (thresholds) {
    if (value >= thresholds.green) return HIGH
    if (value >= thresholds.amber) return MID
    return LOW
  }
  const ratio = value / max
  if (ratio >= 0.8) return HIGH
  if (ratio >= 0.5) return MID
  return LOW
}

export function ScoreChip({
  value,
  max = 100,
  className,
  tint,
  thresholds,
}: {
  value: number | null | undefined
  max?: number
  className?: string
  tint?: { text: string; bg: string }
  thresholds?: { green: number; amber: number }
}) {
  const text = scoreTextClass(value, max, thresholds)
  const bg = text === HIGH ? "bg-green-600/10" : text === MID ? "bg-amber-500/10" : "bg-red-500/10"

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        tint ? undefined : text,
        tint ? undefined : bg,
        className
      )}
      style={tint ? { color: tint.text, backgroundColor: tint.bg } : undefined}
    >
      {value ?? "—"}
    </span>
  )
}
