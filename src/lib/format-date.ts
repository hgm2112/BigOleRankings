export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function formatMonthYear(value: string | null | undefined): string {
  if (!value) return "—"
  let d: Date
  if (/^\d{4}-\d{2}$/.test(value)) {
    d = new Date(`${value}-01T00:00:00`)
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    d = new Date(`${value}T00:00:00`)
  } else {
    d = new Date(value)
  }
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}