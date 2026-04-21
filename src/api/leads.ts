import api from "./axios"

export interface PlayerLead {
  id: number
  email: string
  createdAt: string
}

export interface VenueLead {
  id: number
  contactName: string
  venueName: string
  city: string
  phone: string
  email: string
  sports: string[]
  createdAt: string
}

// Backend returns `sportsJson` as a JSON string. Parse here.
interface VenueLeadRaw {
  id: number
  contactName: string
  venueName: string
  city: string
  phone: string
  email: string
  sportsJson: string
  createdAt: string
}

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
