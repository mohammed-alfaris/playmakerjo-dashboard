import api from "./axios"
import type { BookedSlot } from "@/lib/daySlots"

/** One pitch's day, as the server sees it: hours, capacity and everything already holding it. */
export interface PitchAvailability {
  pitchId: string
  name: string
  sport: string
  parentSize?: string | null
  offeredSizes: string[]
  sizePrices: Record<string, number>
  pricePerHour: number
  capacityUnits: number
  operatingHours?: { open: string; close: string } | null
  bookedSlots: BookedSlot[]
}

export interface DayAvailability {
  venueId: string
  date: string
  minDuration?: number
  maxDuration?: number
  pricePerHour?: number
  pitches: PitchAvailability[]
}

/**
 * The day's availability for every pitch of a venue: bookings, the week's standing
 * reservations and blocked time, from the same data the server's conflict check reads.
 */
export async function getDayAvailability(venueId: string, date: string) {
  const res = await api.get(`/venues/${venueId}/available-slots`, { params: { date } })
  return res.data.data as DayAvailability
}
