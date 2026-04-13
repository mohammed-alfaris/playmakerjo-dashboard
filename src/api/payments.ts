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
}

export async function getPayments(params: PaymentsParams) {
  const res = await api.get("/payments", { params })
  return res.data
}
