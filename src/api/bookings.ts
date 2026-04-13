import api from "./axios"

export interface Booking {
  id: string
  venue: { id: string; name: string; city?: string; images?: string[] }
  player: { id: string; name: string }
  sport: string
  date: string
  startTime?: string
  duration: number
  amount: number
  totalAmount?: number
  depositAmount?: number
  depositPaid?: boolean
  amountPaid?: number
  systemFee?: number
  ownerAmount?: number
  systemFeePercentage?: number
  paymentMethod?: "stripe" | "cliq" | string
  paymentProof?: string | null
  paymentProofStatus?: "pending_review" | "approved" | "rejected" | null
  paymentProofNote?: string | null
  recurringGroupId?: string | null
  status: "pending" | "pending_payment" | "pending_review" | "confirmed" | "cancelled" | "completed"
}

export interface BookingsParams {
  page?: number
  limit?: number
  status?: string
  venue_id?: string
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

export async function reviewProof(id: string, payload: { approved: boolean; note?: string }) {
  const res = await api.patch(`/bookings/${id}/review-proof`, payload)
  return res.data.data as Booking
}
