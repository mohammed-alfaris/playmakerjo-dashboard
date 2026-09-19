import api from "./axios"

export interface PaymentPartyRef {
  id: string
  name: string
}

export interface Payment {
  id: string
  bookingRef: string
  /** The account the booking sits under. On a counter booking this is the OWNER — print `payerName`. */
  player: PaymentPartyRef
  customer?: PaymentPartyRef
  /** Who actually paid, resolved by the backend so no client has to repeat the rule. */
  payerName: string
  /** Who recorded it. Absent on rows written before the ledger existed. */
  recordedBy?: PaymentPartyRef
  venue?: PaymentPartyRef
  amount: number
  method: string
  /** What this row settled — rows are deltas, so a booking can have both. */
  kind: "deposit" | "balance" | "full"
  status: "paid" | "pending" | "failed" | "refunded"
  note?: string
  date: string
}

export interface PaymentTotals {
  count: number
  total: number
  byMethod: Record<string, number>
}

export interface PaymentsParams {
  page?: number
  limit?: number
  status?: string
  method?: string
  from?: string
  to?: string
  /** When set, backend filters payments by the linked booking's venue_id. */
  venueId?: string
}

/** Backend expects snake_case `venue_id`; everything else passes through. */
function toQuery({ venueId, ...rest }: PaymentsParams): Record<string, unknown> {
  const query: Record<string, unknown> = { ...rest }
  if (venueId) query.venue_id = venueId
  return query
}

export async function getPayments(params: PaymentsParams) {
  const res = await api.get("/payments", { params: toQuery(params) })
  return res.data
}

/**
 * Totals for the SAME filter as the list, computed server-side over every matching row —
 * not just the page on screen. Summing the visible page instead would give an owner a
 * figure that quietly disagrees with his cash box.
 */
export async function getPaymentTotals(
  params: Omit<PaymentsParams, "page" | "limit">,
): Promise<PaymentTotals> {
  const res = await api.get("/payments/totals", { params: toQuery(params) })
  return res.data.data
}
