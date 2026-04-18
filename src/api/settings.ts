import api from "./axios"

export interface PlatformSettings {
  platformFeePercentage: number
  maintenanceMode: boolean
  maintenanceMessageEn: string
  maintenanceMessageAr: string
  updatedAt: string
}

export interface UpdateSettingsRequest {
  platformFeePercentage?: number
  maintenanceMode?: boolean
  maintenanceMessageEn?: string
  maintenanceMessageAr?: string
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
