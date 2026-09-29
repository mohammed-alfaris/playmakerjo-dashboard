import api from "./axios"

export interface PlatformSettings {
  platformFeePercentage: number
  maintenanceMode: boolean
  maintenanceMessageEn: string
  maintenanceMessageAr: string
  /** Copied onto each new company when it is created; null = unlimited. */
  defaultMaxVenues: number | null
  defaultMaxStaff: number | null
  updatedAt: string
}

export interface UpdateSettingsRequest {
  platformFeePercentage?: number
  maintenanceMode?: boolean
  maintenanceMessageEn?: string
  maintenanceMessageAr?: string
  /** Sets both defaults at once; null in either = unlimited. */
  defaultLimits?: { maxVenues: number | null; maxStaff: number | null }
}

export async function getSettings(): Promise<{ data: PlatformSettings }> {
  const res = await api.get("/settings")
  return res.data
}

export async function updateSettings(
  body: UpdateSettingsRequest
): Promise<{ data: PlatformSettings; message?: string }> {
  const res = await api.patch("/settings", body)
  return res.data
}
