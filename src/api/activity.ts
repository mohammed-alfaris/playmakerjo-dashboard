import api from "./axios"

/** One thing someone did in a back office. `summary` is "english|arabic". */
export interface ActivityItem {
  id: number
  at: string
  ownerId?: string | null
  /** Admin view only. */
  companyName?: string | null
  actorName?: string | null
  actorRole?: string | null
  /** "booking.cancelled", "payment.refund", … */
  action: string
  entityType: string
  entityId?: string | null
  summary: string
}

export interface ActivityParams {
  /** Admin: a company, or "platform" for PlayMaker's own changes. */
  owner_id?: string
  from?: string
  to?: string
  /** "booking" | "payment" | "venue" | "staff" | "role" | "block" | "invoice" | "company" | … */
  area?: string
  actor_id?: string
  page?: number
  limit?: number
}

export async function getActivity(params: ActivityParams = {}) {
  const res = await api.get("/activity", { params })
  return res.data as { data: ActivityItem[]; pagination: { page: number; limit: number; total: number } }
}
