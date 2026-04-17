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

export async function hideReview(id: string) {
  const res = await api.delete(`/reviews/${id}`)
  return res.data
}
