import api from "./axios"

export interface Booking {
  id: string
  venue: {
    id: string
    name: string
    city?: string
    images?: string[]
    /** The venue's real CliQ alias. Sent by the API as `cliqAlias`. */
    cliqAlias?: string | null
  }
  player: { id: string; name: string }
  /**
   * The venue-side customer, when one was recorded. Null for app bookings and for walk-ins
   * taken before customer records existed — and on those legacy rows `player` is the
   * OWNER'S own name, which is exactly the display bug this field exists to end. Always
   * prefer customer, fall back to player.
   */
  customer?: { id: string; name: string; phone: string } | null
  sport: string
  // Which physical pitch this booking lives on. Legacy rows (no pitchId on the DB)
  // are projected to the venue's implicit first-of-sport pitch on read, so this is
  // always populated for rendering/filtering.
  pitchId?: string | null
  pitchSize?: string | null     // "5" | "6" | "7" | "8" | "11" — null on legacy single-size venues
  date: string
  startTime?: string
  duration: number
  amount: number
  totalAmount?: number
  depositAmount?: number
  depositPaid?: boolean
  amountPaid?: number
  /** Free-text owner notes. Also the only place a legacy walk-in's name survives. */
  notes?: string | null
  /** Taken at the counter or by phone, rather than through the player app. */
  isManual?: boolean
  systemFee?: number
  ownerAmount?: number
  systemFeePercentage?: number
  paymentMethod?: "stripe" | "cliq" | string
  paymentProof?: string | null
  paymentProofStatus?: "pending_review" | "approved" | "rejected" | null
  paymentProofNote?: string | null
  recurringGroupId?: string | null
  status: "pending" | "pending_payment" | "pending_review" | "confirmed" | "cancelled" | "completed" | "no_show"
  /** When this unpaid hold is released. Absent on everything that is not one. */
  paymentDeadlineAt?: string | null
  /**
   * Set when the expiry job released the slot rather than a person cancelling it.
   *
   * There is no "expired" status — the backend writes "cancelled" because that is the only
   * literal every conflict scan treats as freeing a slot. So this field is the ONLY thing
   * separating "the customer changed their mind" from "nobody paid and we took it back",
   * and anything that prints "cancelled" to an owner has to read it first.
   */
  autoCancelledAt?: string | null
}

export interface BookingsParams {
  page?: number
  limit?: number
  status?: string
  venue_id?: string
  // Filter to a specific pitch. Legacy IDs ("legacy-{venueId}-{sport}") are
  // resolved server-side to the venue's first-of-sport pitch, so callers can
  // treat every pitch uniformly.
  pitch_id?: string
  from?: string
  to?: string
  sort?: string
  owner_id?: string
}

export async function getBookings(params: BookingsParams) {
  const res = await api.get("/bookings", { params })
  return res.data
}

export async function getBooking(id: string) {
  const res = await api.get(`/bookings/${id}`)
  return res.data.data as Booking
}

export async function cancelSeries(groupId: string) {
  const res = await api.patch(`/bookings/recurring/${groupId}/cancel`)
  return res.data
}

/** Cancels a single booking — the plain per-row action, distinct from cancelSeries. */
export async function cancelBooking(id: string) {
  const res = await api.patch(`/bookings/${id}/cancel`)
  return res.data.data as Booking
}

export async function reviewProof(id: string, payload: { approved: boolean; note?: string }) {
  const res = await api.patch(`/bookings/${id}/review-proof`, payload)
  return res.data.data as Booking
}

export async function completeBooking(id: string) {
  const res = await api.patch(`/bookings/${id}/complete`)
  return res.data.data as Booking
}

export async function markNoShow(id: string) {
  const res = await api.patch(`/bookings/${id}/no-show`)
  return res.data.data as Booking
}
