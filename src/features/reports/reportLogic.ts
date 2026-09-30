/**
 * The Reports page's pure logic: periods, deltas, colour scale, chart direction. Kept free of
 * React so it can be tested on its own.
 *
 * Dates are Amman calendar dates as "yyyy-MM-dd" — the same days the server reports on. Jordan
 * sits at UTC+3 all year, so "today in Amman" is the UTC date three hours from now; using the
 * browser's own timezone would put an owner travelling abroad on the wrong day.
 */

export type PresetKey = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "last_30" | "custom"

export const PRESETS: Exclude<PresetKey, "custom">[] = [
  "today", "yesterday", "this_week", "this_month", "last_month", "last_30",
]

export type ReportTab = "platform" | "money" | "busy" | "bookings" | "customers"

export interface ReportFilters {
  preset: PresetKey
  from: string
  to: string
  /** "" = all venues in scope. */
  venue: string
  /** Admin only. "" = the whole platform. */
  company: string
  compare: boolean
  /** "" = the viewer's first tab (Platform for an admin, Money for everyone else). */
  tab: ReportTab | ""
}

const AMMAN_OFFSET_MS = 3 * 60 * 60 * 1000

/** Today's date in Amman. */
export function ammanToday(now: Date = new Date()): string {
  return new Date(now.getTime() + AMMAN_OFFSET_MS).toISOString().slice(0, 10)
}

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Inclusive number of days between two dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000) + 1
}

/**
 * The dates a preset stands for. Weeks start on Sunday, as the working week does in Jordan
 * and as the busy-hours grid is laid out.
 */
export function presetRange(preset: Exclude<PresetKey, "custom">, today: string = ammanToday()): { from: string; to: string } {
  const d = toDate(today)
  switch (preset) {
    case "today":
      return { from: today, to: today }
    case "yesterday": {
      const y = addDays(today, -1)
      return { from: y, to: y }
    }
    case "this_week":
      return { from: addDays(today, -d.getUTCDay()), to: today }
    case "this_month":
      return { from: `${today.slice(0, 7)}-01`, to: today }
    case "last_month": {
      const firstThisMonth = `${today.slice(0, 7)}-01`
      const lastPrev = addDays(firstThisMonth, -1)
      return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev }
    }
    case "last_30":
      return { from: addDays(today, -29), to: today }
  }
}

/** The server's comparison period: the same number of days immediately before. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const days = daysBetween(from, to)
  return { from: addDays(from, -days), to: addDays(from, -1) }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const TABS: ReportTab[] = ["platform", "money", "busy", "bookings", "customers"]

/** Filters from the URL, falling back to "this month" for anything missing or malformed. */
export function readFilters(params: URLSearchParams, today: string = ammanToday()): ReportFilters {
  const preset = (params.get("p") as PresetKey) ?? "this_month"
  const known = preset === "custom" || (PRESETS as string[]).includes(preset)
  let range = presetRange("this_month", today)
  let resolved: PresetKey = "this_month"
  if (known && preset !== "custom") {
    range = presetRange(preset, today)
    resolved = preset
  } else if (preset === "custom") {
    const from = params.get("from") ?? ""
    const to = params.get("to") ?? ""
    if (ISO.test(from) && ISO.test(to) && from <= to && daysBetween(from, to) <= 366) {
      range = { from, to }
      resolved = "custom"
    }
  }
  const tab = params.get("tab") as ReportTab
  return {
    preset: resolved,
    ...range,
    venue: params.get("venue") ?? "",
    company: params.get("company") ?? "",
    compare: params.get("compare") === "1",
    tab: TABS.includes(tab) ? tab : "",
  }
}

/** The URL for a set of filters; presets store no dates, so a saved link stays "this month". */
export function writeFilters(f: ReportFilters): URLSearchParams {
  const p = new URLSearchParams()
  p.set("p", f.preset)
  if (f.preset === "custom") {
    p.set("from", f.from)
    p.set("to", f.to)
  }
  if (f.venue) p.set("venue", f.venue)
  if (f.company) p.set("company", f.company)
  if (f.compare) p.set("compare", "1")
  if (f.tab) p.set("tab", f.tab)
  return p
}

/**
 * Relative change in percent, or null when it cannot honestly be stated: no previous value,
 * or a previous value of zero (any growth from nothing is "infinite").
 */
export function deltaPct(value: number, previous: number | null | undefined): number | null {
  if (previous == null) return null
  if (previous === 0) return value === 0 ? 0 : null
  return ((value - previous) / Math.abs(previous)) * 100
}

/** For numbers that are already percentages (rates, occupancy): the change in points. */
export function deltaPoints(value: number, previous: number | null | undefined): number | null {
  return previous == null ? null : value - previous
}

/**
 * Money for a headline tile: whole dinars once it is in the thousands — "JOD 36,700" reads at a
 * glance where "JOD 36,700.45" wraps. Tables and exports keep the exact figure.
 */
export function headlineMoney(n: number, format: (n: number) => string): string {
  return format(Math.abs(n) >= 1000 ? Math.round(n) : n)
}

/**
 * Heatmap cell strength, 0..1, for a percentage. A slight floor keeps an open-but-empty hour
 * visibly different from a closed one (null), which gets no fill at all.
 */
export function heatLevel(pct: number | null): number | null {
  if (pct == null) return null
  const clamped = Math.max(0, Math.min(100, pct))
  return 0.06 + 0.94 * (clamped / 100)
}

/**
 * Recharts axes for the reading direction. In Arabic, time runs right to left like the text,
 * and the value axis sits on the right where the eye starts.
 */
export function axisDirection(dir: "ltr" | "rtl"): { reversed: boolean; yOrientation: "left" | "right" } {
  return dir === "rtl" ? { reversed: true, yOrientation: "right" } : { reversed: false, yOrientation: "left" }
}
