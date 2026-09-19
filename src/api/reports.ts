import api from "./axios"

export interface SummarySparklines {
  /** Last 14 days of gross revenue, oldest → newest. */
  revenue: number[]
  /** Last 14 days of platform-fee revenue, oldest → newest. Zeros for venue_owner. */
  systemRevenue: number[]
  /** Last 14 days of owner-payout revenue, oldest → newest. */
  ownerRevenue: number[]
  /** Last 14 days of booking counts (all statuses), oldest → newest. */
  bookings: number[]
}

export interface SummaryData {
  totalRevenue: number
  ownerRevenue: number
  systemRevenue: number
  platformFeePercentage: number
  totalBookings: number
  totalVenues: number
  totalUsers: number
  /**
   * Period-over-period deltas. Currently always null — they were hardcoded constants
   * rendered as real percentages, and a fabricated growth figure on a paying customer's
   * dashboard is the same defect class as a check that always passes.
   */
  revenueChange?: number | null
  bookingsChange?: number | null
  venuesChange?: number | null
  usersChange?: number | null
  sparklines?: SummarySparklines
}

export interface RevenueChartData {
  date: string
  revenue: number
  ownerRevenue: number
  systemRevenue: number
}

export interface TopVenueData {
  id: string
  name: string
  revenue: number
  ownerRevenue: number
  systemRevenue: number
}

export interface SportBreakdownData {
  sport: string
  count: number
}

export async function getSummary(params?: { owner_id?: string }): Promise<{ data: SummaryData }> {
  const res = await api.get("/reports/summary", { params })
  return res.data
}

export async function getRevenueChart(days = 30): Promise<{ data: RevenueChartData[] }> {
  const res = await api.get("/reports/revenue-chart", { params: { days } })
  return res.data
}

/**
 * Ranked by revenue. The API derives the owner from the token and ignores a client-supplied
 * owner_id, so this cannot widen what comes back — the param is passed only so the query
 * key changes with the identity, and so mock mode can scope the same way the server does.
 * Unscoped, this endpoint was a named competitor leaderboard on the owner's home screen.
 */
export async function getTopVenues(params?: { owner_id?: string }): Promise<{ data: TopVenueData[] }> {
  const res = await api.get("/reports/top-venues", { params })
  return res.data
}

export async function getSportsBreakdown(): Promise<{ data: SportBreakdownData[] }> {
  const res = await api.get("/reports/sports-breakdown")
  return res.data
}

export async function exportReport(params: {
  format: "csv" | "pdf"
  from?: string
  to?: string
  venue_id?: string
}): Promise<Blob> {
  const res = await api.get("/reports/export", {
    params,
    responseType: "blob",
  })
  return res.data
}
