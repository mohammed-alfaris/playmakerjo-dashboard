import api from "./axios"

export interface PermanentBooking {
  id: string
  venueId: string
  pitchId: string | null
  pitchSize: string | null
  sport: string | null
  /** 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). */
  dayOfWeek: number
  /** "HH:mm" 24h. */
  startTime: string
  duration: number
  label: string | null
  /** The server has always sent this; the interface simply never declared it. */
  labelAr: string | null
  /** The organiser. Absent on rows created before standing bookings captured one. */
  customer?: { id: string; name: string; phone: string } | null
  status: "active" | "cancelled"
  createdByUserId: string
  createdAt: string
  cancelledAt: string | null
}

export interface CreatePermanentBookingPayload {
  pitchId?: string | null
  pitchSize?: string | null
  dayOfWeek: number
  startTime: string
  duration: number
  label?: string | null
  /** The organiser's mobile. Optional — a missing number must never block the booking. */
  customerPhone?: string | null
  customerName?: string | null
}

export async function listPermanentBookings(
  venueId: string,
  status?: "active" | "cancelled",
): Promise<PermanentBooking[]> {
  const res = await api.get(`/venues/${venueId}/permanent-bookings`, {
    params: status ? { status } : undefined,
  })
  return res.data.data as PermanentBooking[]
}

export async function createPermanentBooking(
  venueId: string,
  payload: CreatePermanentBookingPayload,
): Promise<PermanentBooking> {
  const res = await api.post(`/venues/${venueId}/permanent-bookings`, payload)
  return res.data.data as PermanentBooking
}

export async function cancelPermanentBooking(id: string): Promise<PermanentBooking> {
  const res = await api.patch(`/permanent-bookings/${id}/cancel`)
  return res.data.data as PermanentBooking
}

export async function deletePermanentBooking(id: string): Promise<void> {
  await api.delete(`/permanent-bookings/${id}`)
}

export interface RecordedOccurrence {
  bookingId: string
  date: string
  startTime: string
  duration: number
  totalAmount: number
  amountPaid: number
  customerName: string | null
  status: string
}

/**
 * Turns ONE week of a standing reservation into a real booking, so the group's money has
 * somewhere to go.
 *
 * A standing reservation is a rule, not a booking — it blocks the slot every week and never
 * becomes a row, so there was nothing to collect against and booking the slot normally was
 * refused by the group's own reservation. Created unpaid: a weekly group pays cash on the
 * night, and the booking sits in "owes money" until it is collected.
 *
 * Idempotent — a second call returns the booking already recorded.
 */
export async function recordStandingWeek(
  permanentId: string,
  date: string,
): Promise<RecordedOccurrence> {
  const res = await api.post(`/permanent-bookings/${permanentId}/record`, { date })
  return res.data.data as RecordedOccurrence
}
