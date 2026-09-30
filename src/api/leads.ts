import api from "./axios"

export interface PlayerLead {
  id: number
  email: string
  createdAt: string
}

export type LeadStatus = "new" | "contacted" | "demo" | "trial" | "won" | "lost"
export const LEAD_STAGES: LeadStatus[] = ["new", "contacted", "demo", "trial", "won", "lost"]

export interface VenueLead {
  id: number
  contactName: string
  venueName: string
  city: string
  phone: string
  email: string
  sports: string[]
  createdAt: string
  status: LeadStatus
  notes?: string | null
  /** "yyyy-MM-dd" */
  nextFollowUpOn?: string | null
  /** The follow-up date has come on a lead still in play. */
  followUpDue: boolean
  lostReason?: string | null
  /** The owner account this lead became. */
  convertedOwnerId?: string | null
  updatedAt?: string | null
}

// Backend returns `sportsJson` as a JSON string. Parse here.
type VenueLeadRaw = Omit<VenueLead, "sports"> & { sportsJson: string }

function parseSports(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

export interface LeadsParams {
  page?: number
  limit?: number
  /** A stage, or "due" for leads whose follow-up date has come. */
  status?: string
}

export async function getPlayerLeads(params: LeadsParams = {}) {
  const res = await api.get("/waitlist/players", { params })
  return res.data as {
    success: boolean
    data: PlayerLead[]
    pagination: { page: number; limit: number; total: number }
  }
}

export async function getVenueLeads(params: LeadsParams = {}) {
  const res = await api.get("/waitlist/venues", { params })
  const raw = res.data.data as VenueLeadRaw[]
  const parsed: VenueLead[] = raw.map(({ sportsJson, ...rest }) => ({
    ...rest,
    sports: parseSports(sportsJson),
  }))
  return {
    success: res.data.success as boolean,
    data: parsed,
    pagination: res.data.pagination as { page: number; limit: number; total: number },
  }
}

export async function getVenueLeadStats() {
  const res = await api.get("/waitlist/venues/stats")
  return res.data.data as { byStatus: Record<LeadStatus, number>; followUpsDue: number }
}

export interface UpdateVenueLead {
  status?: LeadStatus
  /** Replaces the notes; "" clears them. */
  notes?: string
  /** "yyyy-MM-dd"; "" clears it. */
  nextFollowUpOn?: string
  lostReason?: string
  /** The owner account the lead became; marks it won. */
  convertedOwnerId?: string
}

export async function updateVenueLead(id: number, body: UpdateVenueLead) {
  const res = await api.patch(`/waitlist/venues/${id}`, body)
  return res.data.data as VenueLead
}
