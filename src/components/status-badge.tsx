interface StatusBadgeProps {
  status: string | null
  mediaType?: string
  nextAirDate?: string | null
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  "Returning Series": { label: "Renewed", className: "text-green-600 border-green-600/30 bg-green-600/10" },
  Ended: { label: "Ended", className: "text-muted-foreground border-border bg-muted/50" },
  Canceled: { label: "Canceled", className: "text-destructive border-destructive/30 bg-destructive/10" },
}

const FALLBACK_STYLE = "text-muted-foreground border-border bg-muted/50"

export function StatusBadge({ status, mediaType, nextAirDate }: StatusBadgeProps) {
  if (!status || (mediaType && mediaType !== "tv")) return null

  const config = STATUS_STYLES[status]

  const showDate =
    nextAirDate != null &&
    (() => {
      const date = new Date(nextAirDate)
      if (Number.isNaN(date.getTime())) return false
      const cutoff = new Date(date)
      cutoff.setDate(cutoff.getDate() + 30)
      return new Date() <= cutoff
    })()

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
        config?.className ?? FALLBACK_STYLE
      }`}
    >
      {config?.label ?? status}
      {showDate && nextAirDate != null && (
        <>
          <span aria-hidden>&middot;</span>
          <span className="tabular-nums">{new Date(nextAirDate).toLocaleDateString()}</span>
        </>
      )}
    </span>
  )
}
