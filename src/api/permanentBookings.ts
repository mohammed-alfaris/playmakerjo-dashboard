import api from "./axios"

export interface PermanentBooking {
  id: string
  venueId: string
  pitchId: string | null
  pitchSize: string | null
  /** 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). */
  dayOfWeek: number
  /** "HH:mm" 24h. */
  startTime: string
  duration: number
  label: string | null
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
