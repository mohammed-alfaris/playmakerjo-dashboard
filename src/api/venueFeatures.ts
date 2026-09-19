import api from "./axios"

/** A catalog feature as the catalog endpoints return it. `venueCount` is admin-only. */
export interface VenueFeature {
  id: string
  name: string
  nameAr: string
  icon: string
  sortOrder: number
  isActive: boolean
  venueCount?: number
}

/** A catalog feature as it appears on a venue. */
export interface VenueFeatureRef {
  id: string
  name: string
  nameAr: string
  icon: string
}

export interface VenueFeaturePayload {
  name?: string
  nameAr?: string
  icon?: string
  sortOrder?: number
  isActive?: boolean
}

/** Active features, in display order. Admins may ask for retired ones too. */
export async function getVenueFeatures(params: { includeInactive?: boolean } = {}) {
  const res = await api.get("/venue-features", { params })
  return res.data as { data: VenueFeature[] }
}

export async function createVenueFeature(payload: VenueFeaturePayload) {
  const res = await api.post("/venue-features", payload)
  return res.data as { data: VenueFeature }
}

export async function updateVenueFeature(id: string, payload: VenueFeaturePayload) {
  const res = await api.patch(`/venue-features/${id}`, payload)
  return res.data as { data: VenueFeature }
}

export async function deleteVenueFeature(id: string) {
  const res = await api.delete(`/venue-features/${id}`)
  return res.data
}
