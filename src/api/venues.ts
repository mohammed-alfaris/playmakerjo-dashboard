import api from "./axios"
import type { OperatingHours } from "@/lib/types"

// Per-sport override config. Empty map = venue runs on the legacy single-sport
// path (everything read off the venue-level fields). When present, a sport's
// entry overrides the venue-level price / hours. Subdividable split
// (parentSize / subSizes / sizePrices) is only valid for "football".
export interface SportConfig {
  pricePerHour?: number
  operatingHours?: OperatingHours
  parentSize?: string | null
  subSizes?: string[]
  sizePrices?: Record<string, number>
}

// A physical pitch on a venue. One pitch = one sport (multi-sport per pitch deferred).
// Subdivision stays per-pitch: parentSize/subSizes/sizePrices on this object.
// Legacy venues project to a single implicit pitch server-side (id starts with "legacy-").
export interface Pitch {
  id: string
  name: string
  sport: string
  parentSize?: string | null       // football only; "5" | "6" | "7" | "8" | "11"
  subSizes?: string[]
  sizePrices?: Record<string, number>
  pricePerHour: number
  operatingHours?: OperatingHours | null
}

export interface Venue {
  id: string
  name: string
  owner: { id: string; name: string }
  sports: string[]
  city: string
  address: string
  pricePerHour: number
  status: "active" | "inactive" | "pending"
  description?: string
  images?: string[]
  latitude?: number
  longitude?: number
  cliqAlias?: string
  operatingHours?: OperatingHours
  minBookingDuration?: number
  maxBookingDuration?: number
  depositPercentage?: number
  // Subdividable pitch (optional; null/empty = legacy single-size venue)
  parentSize?: string | null       // "5" | "6" | "7" | "8" | "11"
  subSizes?: string[]              // e.g. ["8","6"] or ["7","5"]
  sizePrices?: Record<string, number>  // e.g. { "11": 40, "8": 22, "6": 13 }
  // Per-sport config — keyed by sport name. Empty = single-sport mode.
  sportsConfig?: Record<string, SportConfig>
  // When true, bookings for different sports don't collide (side-by-side courts).
  sportsIsolated?: boolean
  // Multi-pitch venues carry a non-empty pitches[] (e.g. Shabab Jordan: 2×6-aside + 1×7-aside).
  // Legacy venues arrive with an array synthesised server-side from the venue-level
  // fields above — save always writes this array back.
  pitches?: Pitch[]
  createdAt: string
}

export interface VenueStats {
  totalBookings: number
  totalRevenue: number
  activeSince: string
}

export interface VenuesParams {
  page?: number
  limit?: number
  search?: string
  sport?: string
  status?: string
  owner_id?: string
}

export async function getVenues(params: VenuesParams) {
  const res = await api.get("/venues", { params })
  return res.data
}

export async function getVenue(id: string) {
  const res = await api.get(`/venues/${id}`)
  return res.data
}

export async function getVenueStats(id: string) {
  const res = await api.get(`/venues/${id}/stats`)
  return res.data
}

export async function createVenue(data: Partial<Venue>) {
  const res = await api.post("/venues", data)
  return res.data
}

export async function updateVenue(id: string, data: Partial<Venue>) {
  const res = await api.patch(`/venues/${id}`, data)
  return res.data
}

export async function deleteVenue(id: string) {
  const res = await api.delete(`/venues/${id}`)
  return res.data
}

export async function updateVenueStatus(id: string, status: "active" | "inactive") {
  const res = await api.patch(`/venues/${id}`, { status })
  return res.data
}
