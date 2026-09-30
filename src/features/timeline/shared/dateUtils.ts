/** Format a Date as "YYYY-MM-DD" (local timezone). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Return a new Date shifted by `n` days (positive = forward). */
export function addDays(d: Date, n: number): Date {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + n)
  return nd
}

/** Sunday of the week containing `d` — the working week starts Sunday, as elsewhere in the app. */
export function weekStartOf(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return addDays(s, -s.getDay())
}

/**
 * How often the schedule re-reads itself while it is on screen. Two clerks at two desks,
 * or an app booking arriving: without it the lanes stayed as they were at page load.
 */
export const SCHEDULE_REFRESH_MS = 30_000
