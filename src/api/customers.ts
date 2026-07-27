import api from "./axios"

export interface CustomerStats {
  totalBookings: number
  /** Turned up: explicitly completed, or a past booking nobody flagged as a no-show. */
  attended: number
  upcoming: number
  /** Only ever set by a human saying so — never inferred. */
  noShow: number
  cancelled: number
  unpaid: number
  amountOwed: number
  viaCounter: number
  viaApp: number
  lastVisit: string | null
  customerSince: string | null
  daysSinceLastVisit: number | null
  /** noShow / (attended + noShow), 0-100. */
  noShowRate: number
  isRegular: boolean
  isLapsed: boolean
  isNew: boolean
  isUnreliable: boolean
}

export interface Customer {
  id: string
  name: string
  phone: string
  note: string | null
  status: "active" | "archived"
  createdAt: string
  stats: CustomerStats
}

export interface CustomerBookingItem {
  id: string
  venueName: string
  sport: string | null
  date: string
  startTime: string | null
  status: string
  totalAmount: number
  amountPaid: number
  isManual: boolean
}

export interface CustomerDetail extends Customer {
  recentBookings: CustomerBookingItem[]
}

export type CustomerSegment = "all" | "regulars" | "lapsed" | "unreliable" | "owing"

interface Paginated<T> {
  data: T
  pagination?: { page: number; limit: number; total: number }
}

/**
 * Looks a number up the moment it is complete.
 *
 * Returns null for an unknown number — the API answers 200 with `data: null` rather than
 * 404, because "I don't know them" is the normal answer whenever a new customer walks in.
 */
export async function lookupCustomer(phone: string): Promise<Customer | null> {
  const res = await api.get<{ data: Customer | null }>("/customers/lookup", {
    params: { phone },
  })
  return res.data.data ?? null
}

export async function getCustomers(params: {
  page?: number
  limit?: number
  search?: string
  segment?: CustomerSegment
}): Promise<Paginated<Customer[]>> {
  const { segment, ...rest } = params
  const res = await api.get<Paginated<Customer[]>>("/customers", {
    params: { ...rest, segment: segment && segment !== "all" ? segment : undefined },
  })
  return res.data
}

export interface TopCustomerItem {
  id: string
  name: string
  phone: string
  visits: number
  noShow: number
  lastVisit: string | null
  daysSinceLastVisit: number | null
  lifetimeVisits: number
}

export interface CustomerMonthPoint {
  month: string
  newCustomers: number
  returningCustomers: number
}

export interface CustomerReport {
  month: string
  totalCustomers: number
  active: number
  newCustomers: number
  returning: number
  returnRate: number
  visits: number
  noShows: number
  lapsedCount: number
  topCustomers: TopCustomerItem[]
  /** The win-back list — most recently lost first. */
  lapsed: TopCustomerItem[]
  trend: CustomerMonthPoint[]
}

export async function getCustomerReport(month?: string): Promise<CustomerReport> {
  const res = await api.get<{ data: CustomerReport }>("/customers/report", {
    params: month ? { month } : undefined,
  })
  return res.data.data
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  const res = await api.get<{ data: CustomerDetail }>(`/customers/${id}`)
  return res.data.data
}

export async function updateCustomer(
  id: string,
  payload: { name?: string; note?: string },
): Promise<Customer> {
  const res = await api.patch<{ data: Customer }>(`/customers/${id}`, payload)
  return res.data.data
}

/** Archive, never delete — bookings reference the record and they are financial history. */
export async function archiveCustomer(id: string): Promise<Customer> {
  const res = await api.patch<{ data: Customer }>(`/customers/${id}/archive`, {})
  return res.data.data
}

/**
 * Canonical Jordanian mobile, or null. Mirrors the server's PhoneNormalizer so the UI can
 * decide when a number is complete enough to look up — no debounce hook needed, because
 * validity IS the debounce: exactly one keystroke turns null into a number.
 */
export function normalizeJordanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Arabic-Indic and Eastern Arabic-Indic digits first — most owners type on an Arabic
  // keyboard, and nothing else in this app converts them.
  const western = raw.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0)
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660
    return String(code - base)
  })

  let d = western.replace(/\D/g, "")
  if (d.startsWith("00962")) d = d.slice(2)

  let national = ""
  if (d.startsWith("9627") && d.length === 12) national = d.slice(3)
  else if (d.startsWith("07") && d.length === 10) national = d.slice(1)
  else if (d.startsWith("7") && d.length === 9) national = d

  if (!national) return null
  const candidate = `+962${national}`
  return /^\+9627[789]\d{7}$/.test(candidate) ? candidate : null
}

/** A wa.me link that opens the owner's OWN WhatsApp with the message pre-typed. */
export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
}
