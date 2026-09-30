import type { Booking, RefundChoice } from "@/api/bookings"

/** Jordan is UTC+3 all year; the API measures the window with the same fixed offset. */
const AMMAN_OFFSET_MS = 3 * 60 * 60 * 1000

/** A booking's start as a real instant. Its date and "HH:mm" are Amman wall-clock time. */
export function slotStartMs(date: string, startTime?: string | null): number | null {
  if (!startTime) return null
  const [y, mo, d] = date.slice(0, 10).split("-").map(Number)
  const [h, mi] = startTime.split(":").map(Number)
  if ([y, mo, d, h, mi].some((n) => n == null || Number.isNaN(n))) return null
  return Date.UTC(y, mo - 1, d, h, mi) - AMMAN_OFFSET_MS
}

export interface CancelPreview {
  paid: number
  /** Still before the window closes, so the venue's rule refunds. */
  free: boolean
  freeCancelHours: number
  /** Hours from now to the start; null when the booking has no start time. */
  hoursLeft: number | null
}

/**
 * What cancelling now would do to the money, worked out the same way the server does
 * (CancellationPolicy.IsFreeToCancel): free when the start is at least the venue's window
 * away. A booking without a start time counts as late — keeping money is the reversible side.
 */
export function cancelPreview(b: Booking, nowMs: number): CancelPreview {
  const paid = Math.max(0, b.amountPaid ?? 0)
  const freeCancelHours = b.venue.freeCancelHours ?? 24
  const start = slotStartMs(b.date, b.startTime)
  const hoursLeft = start == null ? null : (start - nowMs) / 3_600_000
  const free = hoursLeft != null && hoursLeft >= Math.max(0, freeCancelHours)
  return { paid, free, freeCancelHours, hoursLeft }
}

/** What each choice refunds. Mirrors CancellationPolicy.RefundFor. */
export function refundFor(p: CancelPreview, choice: RefundChoice): number {
  if (p.paid <= 0) return 0
  if (choice === "all") return p.paid
  if (choice === "none") return 0
  return p.free ? p.paid : 0
}
