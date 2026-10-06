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

// ─── Business reports ────────────────────────────────────────────────────────
// Every number is defined once on the server (Services/Reports/ReportsService.cs). Money is
// JOD; dates are Amman calendar dates "yyyy-MM-dd".

export interface ReportParams {
  from: string
  to: string
  venue_id?: string
  /** Admin only: one company's view. Ignored by the server for anyone else. */
  owner_id?: string
  compare?: boolean
}

/** A headline number; `previous` only when compare was asked for. */
export interface Kpi {
  value: number
  previous: number | null
}

export interface PeriodInfo {
  from: string
  to: string
  days: number
  previousFrom: string | null
  previousTo: string | null
}

export interface KeyAmount { key: string; amount: number; count: number }
export interface KeyCount { key: string; count: number }

export interface MoneyReport {
  period: PeriodInfo
  collected: Kpi
  booked: Kpi
  /** Owed right now for counter bookings already played — not tied to the period. */
  outstanding: number
  outstandingCount: number
  /** Admin only; null for owners and staff. */
  platformFee: Kpi | null
  net: Kpi | null
  byMethod: KeyAmount[]
  byKind: KeyAmount[]
  daily: { date: string; cash: number; cliq: number; other: number; booked: number }[]
  byVenue: { venueId: string; name: string; nameAr: string | null; collected: number; booked: number; bookings: number }[]
  byPitch: { venueId: string; venueName: string; pitchId: string; pitchName: string; pitchNameAr: string | null; booked: number; bookings: number }[]
  outstandingItems: {
    bookingId: string; date: string; startTime: string | null; venueName: string
    customerId: string | null; customerName: string | null; customerPhone: string | null
    total: number; paid: number; owed: number
  }[]
}

export interface BookingsReport {
  period: PeriodInfo
  bookings: Kpi
  cancelRate: Kpi
  noShowRate: Kpi
  attended: number
  noShows: number
  cancelledByPerson: number
  cancelledExpired: number
  byStatus: KeyCount[]
  byChannel: KeyCount[]
  daily: { date: string; app: number; counter: number; weekly: number; series: number; cancelled: number; web?: number }[]
  leadTime: KeyCount[]
  sports: KeyCount[]
}

/** Day 0 = Sunday. `pct` null when nothing was open. */
export interface OccupancyCell { day: number; hour: number; openHours: number; bookedHours: number; pct: number | null }

export interface OccupancyReport {
  period: PeriodInfo
  occupancy: Kpi
  openHours: number
  bookedHours: number
  grid: OccupancyCell[]
  byPitch: { venueId: string; venueName: string; pitchId: string; pitchName: string; pitchNameAr: string | null; openHours: number; bookedHours: number; pct: number | null }[]
  busiest: OccupancyCell[]
  quietest: OccupancyCell[]
}

export interface TopCustomer { id: string; name: string; phone: string; visits: number; paid: number }

export interface CustomersReport {
  period: PeriodInfo
  /** Null for staff without customers.view. */
  customers: {
    active: Kpi
    new: Kpi
    returning: number
    returnRate: number
    lapsed: number
    topByVisits: TopCustomer[]
    topBySpend: TopCustomer[]
  } | null
  /** Owner and admin only. `userId` null = taken by the app itself. */
  team: {
    userId: string | null; name: string; role: string
    payments: number; collected: number; cash: number; cliq: number; counterBookings: number
  }[] | null
}

export interface PlatformReport {
  period: PeriodInfo
  booked: Kpi
  fee: Kpi
  collected: Kpi
  bookings: Kpi
  appShare: Kpi
  newCompanies: Kpi
  newVenues: Kpi
  newPlayers: Kpi
  activeCompanies: Kpi
  daily: { date: string; booked: number; fee: number; bookings: number }[]
  companies: {
    ownerId: string; name: string; nameAr: string | null; ownerStatus: string
    venues: number; bookings: number; booked: number; fee: number; collected: number
  }[]
}

async function report<T>(path: string, params: ReportParams): Promise<T> {
  const res = await api.get<{ data: T }>(`/reports/${path}`, { params })
  return res.data.data
}

export const getMoneyReport = (p: ReportParams) => report<MoneyReport>("money", p)
export const getBookingsReport = (p: ReportParams) => report<BookingsReport>("bookings", p)
export const getOccupancyReport = (p: ReportParams) => report<OccupancyReport>("occupancy", p)
export const getCustomersReport = (p: ReportParams) => report<CustomersReport>("customers", p)
export const getPlatformReport = (p: Pick<ReportParams, "from" | "to" | "compare">) =>
  report<PlatformReport>("platform", p)

/** Every report the caller may see, as one workbook. */
export async function downloadReportExcel(p: ReportParams, lang: "en" | "ar"): Promise<Blob> {
  const res = await api.get("/reports/export.xlsx", {
    params: { from: p.from, to: p.to, venue_id: p.venue_id, owner_id: p.owner_id, lang },
    responseType: "blob",
  })
  return res.data
}
