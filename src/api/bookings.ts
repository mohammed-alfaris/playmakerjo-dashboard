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
    /** Cancelling at least this many hours before the start refunds what was paid. */
    freeCancelHours?: number
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

/**
 * What a cancellation does to money already paid:
 *  - "policy": the venue's free-cancellation window decides (refund before it, keep inside it)
 *  - "all":    refund everything anyway
 *  - "none":   keep everything
 * Anything but "policy" needs payments.record; a clerk without it cancels and the money stays.
 */
export type RefundChoice = "policy" | "all" | "none"

/** Cancels a single booking — the plain per-row action, distinct from cancelSeries. */
export async function cancelBooking(id: string, refund: RefundChoice = "policy") {
  const res = await api.patch(`/bookings/${id}/cancel`, { refund })
  return { booking: res.data.data as Booking, message: res.data.message as string }
}

/** Money going back: a refund to the customer, or a correction of a payment recorded by mistake. */
export async function refundBooking(id: string, payload: { amount: number; kind: "refund" | "correction"; note?: string }) {
  const res = await api.post(`/bookings/${id}/refund`, payload)
  return res.data.data as Booking
}

export interface UpdateBookingPayload {
  date?: string
  startTime?: string
  duration?: number
  pitchId?: string
  pitchSize?: string
  /** A price agreed with the customer. Needs payments.record. Left out, the list price applies. */
  totalAmount?: number
  notes?: string
}

/**
 * Moves or re-prices a booking. The new slot passes the same checks as a new booking, so a
 * refusal comes back as a 400/409 with a message worth showing as it is.
 */
export async function updateBooking(id: string, payload: UpdateBookingPayload) {
  const res = await api.patch(`/bookings/${id}`, payload)
  return { booking: res.data.data as Booking, message: res.data.message as string }
}

export interface ReceiptLine {
  date: string
  /** Negative for a refund or correction. */
  amount: number
  method?: string | null
  kind?: "deposit" | "balance" | "full" | "refund" | "correction" | string | null
  note?: string | null
}

export interface BookingReceipt {
  receiptNumber: string
  issuedAt: string
  companyName?: string | null
  companyNameAr?: string | null
  venueName: string
  venueNameAr?: string | null
  venueAddress?: string | null
  venueCity?: string | null
  customerName?: string | null
  customerPhone?: string | null
  sport: string
  pitchName?: string | null
  pitchSize?: string | null
  date: string
  startTime?: string | null
  duration: number
  status: Booking["status"]
  totalAmount: number
  amountPaid: number
  balance: number
  payments: ReceiptLine[]
}

export async function getReceipt(id: string) {
  const res = await api.get(`/bookings/${id}/receipt`)
  return res.data.data as BookingReceipt
}

export async function reviewProof(id: string, payload: { approved: boolean; note?: string }) {
  const res = await api.patch(`/bookings/${id}/review-proof`, payload)
  return res.data.data as Booking
}

/**
 * Marks the booking completed AND collects any outstanding balance in the same call — one act
 * at the counter, because "he played" and "he paid" are the same moment.
 *
 * For money WITHOUT completion (an upcoming slot prepaid, or a pending_payment booking settled
 * at the counter) the API exposes PATCH /bookings/{id}/mark-paid. Nothing in the dashboard calls
 * it yet — see GAP-ANALYSIS.md.
 */
export async function completeBooking(id: string) {
  const res = await api.patch(`/bookings/${id}/complete`)
  return res.data.data as Booking
}

/**
 * Records that the outstanding balance has been collected, without completing the booking.
 *
 * The endpoint has existed and been tested since the payment ledger landed; nothing called
 * it, so a booking taken as "pays on arrival" read as owing forever even after the cash was
 * in the drawer. Settles the FULL remaining amount — partial payments are deliberately not
 * offered here.
 *
 * Idempotent server-side: a second call returns 200 and writes no second ledger row, so a
 * double-tap on a slow connection cannot book the takings twice.
 */
export async function markBookingPaid(id: string) {
  const res = await api.patch(`/bookings/${id}/mark-paid`)
  return res.data.data as Booking
}

export async function markNoShow(id: string) {
  const res = await api.patch(`/bookings/${id}/no-show`)
  return res.data.data as Booking
}
