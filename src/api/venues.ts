import api from "./axios"

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
  operatingHours?: unknown
  minBookingDuration?: number
  maxBookingDuration?: number
  depositPercentage?: number
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
