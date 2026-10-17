/**
 * Start times for one pitch on one day, each marked free or taken — the time grid of the
 * new-booking page.
 *
 * Reads the server's own availability answer (GET /venues/{id}/available-slots): per pitch,
 * the day's opening hours, its capacity in units and everything holding part of it — real
 * bookings, the week's standing reservations and blocked time, each with the units it uses.
 * So the grid and the server's conflict check start from the same facts; the arithmetic below
 * is the same capacity rule the player app and the website use (11-a-side = 4 units, 7/8 = 2,
 * 5/6 = 1). The server still re-checks on save, inside its lock, and is what actually decides.
 */

export interface BookedSlot {
  startTime: string
  duration: number
  unitWeight?: number
}

export interface PitchDay {
  operatingHours?: { open: string; close: string } | null
  bookedSlots: BookedSlot[]
  capacityUnits?: number
}

export interface DaySlot {
  /** Minutes after midnight. */
  start: number
  /** "HH:mm", as the API takes it. */
  time: string
  free: boolean
}

export const unitWeight = (size?: string | null) =>
  size === "11" ? 4 : size === "8" || size === "7" ? 2 : 1

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":")
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`

export function daySlots(
  day: PitchDay | null | undefined,
  opts: { size?: string | null; duration: number; nowMin?: number | null; step?: number },
): DaySlot[] {
  if (!day?.operatingHours) return []
  const step = opts.step ?? 30
  const open = toMin(day.operatingHours.open)
  let close = toMin(day.operatingHours.close)
  if (close <= open) close += 24 * 60
  const overnight = close > 24 * 60
  const capacity = day.capacityUnits && day.capacityUnits > 0 ? day.capacityUnits : 1
  const need = unitWeight(opts.size)

  const out: DaySlot[] = []
  // Starts stay on this calendar day: a start after midnight belongs to the next day's grid,
  // which is where the server reads it.
  for (let start = open; start + opts.duration <= close && start < 24 * 60; start += step) {
    // Today, nothing in the past or starting within the next half hour.
    if (opts.nowMin != null && start < opts.nowMin + 30) continue
    const end = start + opts.duration
    let used = 0
    for (const b of day.bookedSlots) {
      let s = toMin(b.startTime)
      if (overnight && s < open) s += 24 * 60
      if (start < s + b.duration && end > s) used += b.unitWeight && b.unitWeight > 0 ? b.unitWeight : 1
    }
    out.push({ start, time: toHHMM(start), free: used + need <= capacity })
  }
  return out
}
