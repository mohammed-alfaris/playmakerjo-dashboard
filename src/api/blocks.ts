import api from "./axios"

/**
 * Time a venue is not selling: maintenance, a holiday, a private event. Nothing can be
 * booked into it, from the app or the counter. Times are Amman wall-clock, "yyyy-MM-ddTHH:mm",
 * and the end is exclusive.
 */
export interface VenueBlock {
  id: string
  venueId: string
  /** Null when the whole venue is closed. */
  pitchId: string | null
  startsAt: string
  endsAt: string
  reason?: string | null
  createdAt: string
}

export interface BlockedBookingInfo {
  id: string
  date: string
  startTime?: string | null
  duration: number
  pitchId?: string | null
  customerName?: string | null
  status: string
}

export async function listBlocks(venueId: string, from: string, to: string) {
  const res = await api.get(`/venues/${venueId}/blocks`, { params: { from, to } })
  return res.data.data as VenueBlock[]
}

/** Blocks the time. Bookings already inside it are returned, not cancelled. */
export async function createBlock(
  venueId: string,
  payload: { pitchId?: string | null; startsAt: string; endsAt: string; reason?: string },
) {
  const res = await api.post(`/venues/${venueId}/blocks`, payload)
  return res.data.data as { block: VenueBlock; overlappingBookings: BlockedBookingInfo[] }
}

export async function deleteBlock(venueId: string, blockId: string) {
  await api.delete(`/venues/${venueId}/blocks/${blockId}`)
}
