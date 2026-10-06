import api from "./axios"

export interface PlatformSettings {
  platformFeePercentage: number
  maintenanceMode: boolean
  maintenanceMessageEn: string
  maintenanceMessageAr: string
  /** Copied onto each new company when it is created; null = unlimited. */
  defaultMaxVenues: number | null
  defaultMaxStaff: number | null
  /** What a company without its own prices pays, and the terms every company gets. */
  billing: BillingDefaults
  updatedAt: string
}

export interface BillingDefaults {
  /** Monthly price of a venue with fewer than largeVenueMinPitches pitches. */
  priceSmallVenue: number
  priceLargeVenue: number
  largeVenueMinPitches: number
  setupFee: number
  trialDays: number
  paymentTermsDays: number
}

export interface UpdateSettingsRequest {
  platformFeePercentage?: number
  maintenanceMode?: boolean
  maintenanceMessageEn?: string
  maintenanceMessageAr?: string
  /** Sets both defaults at once; null in either = unlimited. */
  defaultLimits?: { maxVenues: number | null; maxStaff: number | null }
  /** Sets every billing default at once. */
  billing?: BillingDefaults
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
