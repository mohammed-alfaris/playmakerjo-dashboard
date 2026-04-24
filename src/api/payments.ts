import api from "./axios"

export interface Payment {
  id: string
  bookingRef: string
  player: { id: string; name: string }
  amount: number
  method: string
  status: "paid" | "pending" | "failed" | "refunded"
  date: string
}

export interface PaymentsParams {
  page?: number
  limit?: number
  status?: string
  /** When set, backend filters payments by the linked booking's venue_id. */
  venueId?: string
}

export async function getPayments(params: PaymentsParams) {
  const { venueId, ...rest } = params
  // Backend expects snake_case `venue_id`.
  const query: Record<string, unknown> = { ...rest }
  if (venueId) query.venue_id = venueId
  const res = await api.get("/payments", { params: query })
  return res.data
}
