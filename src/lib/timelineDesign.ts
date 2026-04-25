/**
 * Shared design helpers for the V1 "Lanes Timeline" + Venue Profile redesign.
 *
 * Ported from design-extracted/timeslots-dashboard/project/shared.jsx, adapted to
 * the real dashboard data shapes (Booking.startTime/duration vs. startMin).
 */

import type { Pitch, Venue } from "@/api/venues"
import type { Booking } from "@/api/bookings"
import type { DayHours, DayOfWeek, OperatingHours } from "@/lib/types"

// ---------- Layout constants ----------

/**
 * Default frame when a venue has no operating hours for the day.
 * Use {@link frameFor} to get the real per-venue frame.
 */
export const HOURS_START = 8
export const HOURS_END = 24
export const PX_PER_MIN = 1.6
export const LANE_H = 50

// ---------- Status / group system ----------

export type StatusGroup = "confirmed" | "hold" | "done" | "issue" | "open" | "blocked"

export type ColorName =
  | "brand" | "amber" | "sky" | "violet" | "indigo"
  | "rose" | "slate" | "open" | "blocked"

export type RenderStatus =
  | "confirmed" | "pending" | "pending_payment" | "pending_review"
  | "completed" | "no_show" | "cancelled"
  | "open" | "blocked"

interface StatusMeta {
  group: StatusGroup
  label: string    // fallback English label; UI layer can translate
  color: ColorName
  glyph: string
}

export const STATUS_META: Record<RenderStatus, StatusMeta> = {
  confirmed:       { group: "confirmed", label: "Confirmed",       color: "brand",  glyph: "●" },
  pending:         { group: "hold",      label: "Pending",         color: "amber",  glyph: "◐" },
  pending_payment: { group: "hold",      label: "Awaiting pay",    color: "sky",    glyph: "$" },
  pending_review:  { group: "hold",      label: "Proof to review", color: "violet", glyph: "!" },
  completed:       { group: "done",      label: "Completed",       color: "indigo", glyph: "✓" },
  no_show:         { group: "issue",     label: "No-show",         color: "rose",   glyph: "✕" },
  cancelled:       { group: "issue",     label: "Cancelled",       color: "slate",  glyph: "/" },
  open:            { group: "open",      label: "Open",            color: "open",   glyph: "+" },
  blocked:         { group: "blocked",   label: "Closed",          color: "blocked", glyph: "" },
}

export const GROUP_META: Record<Exclude<StatusGroup, "open" | "blocked">, { label: string; color: ColorName }> = {
  confirmed: { label: "Confirmed", color: "brand"  },
  hold:      { label: "Hold",      color: "amber"  },
  done:      { label: "Done",      color: "indigo" },
  issue:     { label: "Issue",     color: "rose"   },
}

/** Resolves a color name to a palette object of CSS values. */
export function colorFor(name: ColorName | string): { bg: string; fg: string; tint: string; ink: string } {
  switch (name) {
    case "brand":
      return { bg: "hsl(var(--brand))", fg: "hsl(var(--primary-foreground))", tint: "hsl(var(--brand-tint))", ink: "hsl(var(--brand-ink))" }
    case "amber":
      return { bg: "hsl(var(--amber))", fg: "#fff", tint: "hsl(var(--amber-tint))", ink: "hsl(var(--amber-ink))" }
    case "sky":
      return { bg: "hsl(var(--sky))", fg: "#fff", tint: "hsl(var(--sky-tint))", ink: "hsl(var(--sky-ink))" }
    case "violet":
      return { bg: "hsl(var(--violet))", fg: "#fff", tint: "hsl(var(--violet-tint))", ink: "hsl(var(--violet-ink))" }
    case "indigo":
      return { bg: "hsl(var(--indigo))", fg: "#fff", tint: "hsl(var(--indigo-tint))", ink: "hsl(var(--indigo-ink))" }
    case "rose":
      return { bg: "hsl(var(--rose))", fg: "#fff", tint: "hsl(var(--rose-tint))", ink: "hsl(var(--rose-ink))" }
    case "slate":
      return { bg: "hsl(var(--slate-ink))", fg: "#fff", tint: "hsl(var(--surface-2))", ink: "hsl(var(--slate-ink))" }
    default:
      return { bg: "hsl(var(--surface-2))", fg: "hsl(var(--ink-2))", tint: "hsl(var(--surface-2))", ink: "hsl(var(--ink-2))" }
  }
}

// ---------- Time helpers ----------

/** "HH:mm" -> minutes. Defaults to 0 on empty/invalid input. */
export function parseHHMM(s: string | undefined | null): number {
  if (!s) return 0
  const [h, m] = s.split(":").map((v) => Number(v) || 0)
  return h * 60 + m
}

export function fmtHour(mins: number): string {
  const norm = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function fmt12(mins: number): string {
  const norm = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(norm / 60)
  const m = norm % 60
  const s = h >= 12 ? "pm" : "am"
  const h12 = ((h + 11) % 12) + 1
  return m === 0 ? `${h12}${s}` : `${h12}:${String(m).padStart(2, "0")}${s}`
}

export function fmtRange(startMin: number, endMin: number): string {
  return `${fmt12(startMin)} – ${fmt12(endMin)}`
}

export function addDays(d: Date, n: number): Date {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + n)
  return nd
}

export function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

/** Returns the signed day offset between two dates, zeroed to midnight. */
export function daysAway(d: Date, base: Date): number {
  const a = new Date(d); a.setHours(0, 0, 0, 0)
  const b = new Date(base); b.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

// ---------- Operating hours resolution ----------

const FULL_TO_SHORT: Record<DayOfWeek, string> = {
  monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu",
  friday: "fri", saturday: "sat", sunday: "sun",
}

export const DAYS_ORDER: Array<{ full: DayOfWeek; short: string; label: string }> = [
  { full: "monday",    short: "mon", label: "Monday"    },
  { full: "tuesday",   short: "tue", label: "Tuesday"   },
  { full: "wednesday", short: "wed", label: "Wednesday" },
  { full: "thursday",  short: "thu", label: "Thursday"  },
  { full: "friday",    short: "fri", label: "Friday"    },
  { full: "saturday",  short: "sat", label: "Saturday"  },
  { full: "sunday",    short: "sun", label: "Sunday"    },
]

const INDEX_TO_FULL: DayOfWeek[] = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
]

/** JS Date -> OperatingHours key ("monday" ... "sunday"). */
export function dayKeyOf(date: Date): DayOfWeek {
  return INDEX_TO_FULL[date.getDay()]
}

/** Read a day's hours from an OperatingHours object. Returns null if closed or missing. */
export function hoursFor(oh: OperatingHours | undefined, date: Date): DayHours | null {
  if (!oh) return null
  const k = dayKeyOf(date)
  const h = oh[k]
  if (!h || h.closed) return null
  if (!h.open || !h.close) return null
  return h
}

/**
 * Compute the timeline frame [startMin, endMin] for a given date, derived
 * from the venue's operating hours. Returns minutes-from-midnight, with
 * `endMin` rolled past 24h when hours cross midnight (e.g. 9am-1am ->
 * 540..1500). Times are rounded outward to the nearest whole hour so the
 * hour ticks land cleanly.
 *
 * Falls back to {@link HOURS_START}..{@link HOURS_END} (08:00–24:00) when
 * the venue is closed that day or has no hours configured.
 */
export function frameFor(
  oh: OperatingHours | undefined,
  date: Date,
): { startMin: number; endMin: number } {
  const h = hoursFor(oh, date)
  if (!h) return { startMin: HOURS_START * 60, endMin: HOURS_END * 60 }
  const open = parseHHMM(h.open)
  let close = parseHHMM(h.close)
  if (close <= open) close += 24 * 60
  const startMin = Math.floor(open / 60) * 60
  const endMin = Math.ceil(close / 60) * 60
  return { startMin, endMin }
}

// ---------- Lane assignment (football split) ----------

export const UNIT_WEIGHT: Record<string, number> = {
  "11": 4, "8": 2, "7": 2, "6": 1, "5": 1,
}

/**
 * Number of parallel lanes this pitch splits into. Returns 1 for non-football
 * or pitches without subSizes.
 */
export function lanesFor(pitch: Pick<Pitch, "sport" | "parentSize" | "subSizes">): number {
  if (pitch.sport !== "football" || !pitch.parentSize || !pitch.subSizes?.length) return 1
  const sizes = [pitch.parentSize, ...pitch.subSizes]
  const smallest = Math.min(...sizes.map((s) => UNIT_WEIGHT[s] ?? 1))
  if (smallest <= 0) return 1
  return Math.max(1, Math.floor((UNIT_WEIGHT[pitch.parentSize] ?? 1) / smallest))
}

/** Slim view of a booking that the lane allocator needs. */
export interface LaneBooking {
  id: string
  startMin: number
  duration: number
  pitchSize?: string | null
}

export interface LaneAssignment<B extends LaneBooking = LaneBooking> {
  booking: B
  topLane: number
  laneSpan: number
  nLanes: number
}

/** Greedy first-fit lane allocator. Mirrors shared.jsx assignLanes. */
export function assignLanes<B extends LaneBooking>(
  pitch: Pick<Pitch, "sport" | "parentSize" | "subSizes">,
  bookings: B[],
): LaneAssignment<B>[] {
  const nLanes = lanesFor(pitch)
  if (nLanes === 1) {
    return bookings.map((b) => ({ booking: b, topLane: 0, laneSpan: 1, nLanes: 1 }))
  }
  const sizes = [pitch.parentSize!, ...(pitch.subSizes ?? [])]
  const smallest = Math.min(...sizes.map((s) => UNIT_WEIGHT[s] ?? 1))
  const laneBusy: Array<Array<{ start: number; end: number }>> = Array.from({ length: nLanes }, () => [])
  const sorted = [...bookings].sort((a, b) => a.startMin - b.startMin)
  const result: LaneAssignment<B>[] = []
  for (const b of sorted) {
    const size = b.pitchSize || pitch.parentSize || ""
    const w = UNIT_WEIGHT[size] ?? 1
    const span = Math.max(1, Math.floor(w / smallest))
    let placed = -1
    for (let s = 0; s + span <= nLanes; s++) {
      let fits = true
      for (let k = 0; k < span; k++) {
        const lane = laneBusy[s + k]
        if (lane.some((x) => b.startMin < x.end && b.startMin + b.duration > x.start)) {
          fits = false
          break
        }
      }
      if (fits) { placed = s; break }
    }
    if (placed < 0) placed = 0
    for (let k = 0; k < span; k++) {
      laneBusy[placed + k].push({ start: b.startMin, end: b.startMin + b.duration })
    }
    result.push({ booking: b, topLane: placed, laneSpan: span, nLanes })
  }
  return result
}

// ---------- Booking shape adapter ----------

/** Map a real Booking -> lane-ready numeric slot. */
export function bookingToLane(b: Booking): LaneBooking {
  const startMin = parseHHMM(b.startTime ?? "00:00")
  return { id: b.id, startMin, duration: b.duration, pitchSize: b.pitchSize ?? undefined }
}

/** Consolidate a raw booking.status into the 4-group + tint color. */
export function renderStatusFor(b: Booking): RenderStatus {
  // Backend uses "confirmed"; the design uses "booked" for the same state.
  // Map any live-reservation synonym to the single design key.
  if (b.status === "pending_review") return "pending_review"
  if (b.paymentProofStatus === "pending_review") return "pending_review"
  return b.status as RenderStatus
}

// ---------- Utilization ----------

/** Compute utilization 0..1 for a single day across a venue's pitches. */
export function utilizationFor(
  venue: Pick<Venue, "operatingHours" | "pitches" | "parentSize" | "subSizes" | "sports">,
  bookings: Booking[],
  date: Date,
): number {
  const hours = hoursFor(venue.operatingHours, date)
  if (!hours) return 0
  const openM = parseHHMM(hours.open)
  const closeM = parseHHMM(hours.close)
  const endM = closeM <= openM ? closeM + 24 * 60 : closeM
  const dayMinutes = endM - openM
  if (dayMinutes <= 0) return 0

  const pitches = venue.pitches ?? []
  if (!pitches.length) {
    // Legacy: treat as single capacity-1 pitch.
    const used = bookings.reduce((sum, b) => sum + (b.duration || 0), 0)
    return Math.min(1, used / dayMinutes)
  }
  let capacityMin = 0
  let usedMin = 0
  for (const p of pitches) {
    const cap = UNIT_WEIGHT[p.parentSize ?? ""] ?? 1
    capacityMin += cap * dayMinutes
    const ofPitch = bookings.filter((b) => b.pitchId === p.id)
    for (const b of ofPitch) {
      const w = UNIT_WEIGHT[b.pitchSize ?? p.parentSize ?? ""] ?? 1
      usedMin += w * (b.duration || 0)
    }
  }
  if (capacityMin <= 0) return 0
  return Math.min(1, usedMin / capacityMin)
}

// ---------- Translation-key mapping (V1 additions) ----------

export const GROUP_TRANSLATION_KEY: Record<keyof typeof GROUP_META, string> = {
  confirmed: "group_confirmed",
  hold:      "group_hold",
  done:      "group_done",
  issue:     "group_issue",
}

/** Used in dayKeyOf -> FULL_TO_SHORT for places that receive a short key. */
export function shortOf(full: DayOfWeek): string {
  return FULL_TO_SHORT[full]
}
