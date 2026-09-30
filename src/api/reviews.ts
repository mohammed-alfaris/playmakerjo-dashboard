import api from "./axios"

export interface Review {
  id: string
  playerId: string
  playerName: string
  playerAvatar?: string | null
  venueId: string
  venueName?: string
  rating: number
  comment?: string | null
  createdAt: string
  updatedAt: string
  hidden: boolean
}

export interface ReviewsParams {
  page?: number
  limit?: number
  venueId?: string
  status?: "visible" | "hidden"
  from?: string
  to?: string
}

export async function getReviews(params: ReviewsParams) {
  const res = await api.get("/reviews/admin", { params })
  return res.data
}

/**
 * One venue's reviews, readable by that venue's own side.
 *
 * getReviews above hits /reviews/admin, which is super_admin only — so the venue detail
 * page's Reviews tab 403'd for every owner looking at their OWN venue.
 */
export async function getVenueReviews(venueId: string, params: { page?: number; limit?: number }) {
  const res = await api.get(`/reviews/venue/${venueId}`, { params })
  return res.data
}

export async function hideReview(id: string) {
  const res = await api.delete(`/reviews/${id}`)
  return res.data
}

/**
 * Puts a hidden review back. Hiding also strips the rating from the venue's public
 * average, so without this a misclick permanently lowered a venue's score.
 */
export async function restoreReview(id: string) {
  const res = await api.patch(`/reviews/${id}/restore`)
  return res.data
}
