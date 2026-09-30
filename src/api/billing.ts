import api from "./axios"

export type InvoiceStatus = "draft" | "issued" | "paid" | "void"
export type InvoiceLineKind = "subscription" | "extra_venues" | "setup_fee" | "commission" | "adjustment"
export type PayMethod = "cliq" | "bank_transfer" | "cash"

export interface InvoiceLine {
  id: string
  kind: InvoiceLineKind
  description: string
  descriptionAr?: string | null
  quantity: number
  unitPrice: number
  /** Negative for a discount. */
  amount: number
}

/** What PlayMaker bills a company for one month. */
export interface Invoice {
  id: string
  /** "PMJ-2026-0001"; null while a draft. */
  number: string | null
  ownerId: string
  companyName: string
  companyNameAr?: string | null
  /** "yyyy-MM" */
  period: string
  status: InvoiceStatus
  /** Issued, unpaid, past its due date. */
  overdue: boolean
  total: number
  issuedAt?: string | null
  dueOn?: string | null
  paidAt?: string | null
  paidMethod?: PayMethod | null
  paidReference?: string | null
  voidReason?: string | null
  createdAt: string
  lines: InvoiceLine[]
}

/** Where a company stands with PlayMaker. Prices are what it pays — its own or the default. */
export interface CompanyBilling {
  status: "trial" | "active" | "suspended"
  cycle: "monthly" | "annual"
  trialEndsOn?: string | null
  priceFirstVenue: number
  priceExtraVenue: number
  customPrices: boolean
  setupFeeWaived: boolean
  overdueCount: number
  overdueAmount: number
  suspendedAt?: string | null
  suspendedReason?: string | null
}

export interface SkippedCompany {
  ownerId: string
  companyName: string
  reason: "already_invoiced" | "in_trial" | "nothing_to_bill" | "suspended" | "owner_inactive"
}

interface Paginated<T> {
  data: T
  pagination?: { page: number; limit: number; total: number }
}

export interface InvoicesParams {
  period?: string
  /** A status, or "overdue". */
  status?: string
  owner_id?: string
  page?: number
  limit?: number
}

/** Admin: every invoice. Owner: their own issued ones (never drafts). */
export async function getInvoices(params: InvoicesParams = {}): Promise<Paginated<Invoice[]>> {
  const res = await api.get("/invoices", { params })
  return res.data
}

export async function getInvoice(id: string): Promise<Invoice> {
  const res = await api.get(`/invoices/${id}`)
  return res.data.data
}

/** Admin: draft the month's invoices — for every company, or one. Safe to press twice. */
export async function generateInvoices(period: string, ownerId?: string) {
  const res = await api.post("/invoices/generate", { period, ownerId })
  return res.data.data as { period: string; created: Invoice[]; skipped: SkippedCompany[] }
}

export async function addInvoiceLine(id: string, body: { description: string; descriptionAr?: string; amount: number }): Promise<Invoice> {
  const res = await api.post(`/invoices/${id}/lines`, body)
  return res.data.data
}

export async function removeInvoiceLine(id: string, lineId: string): Promise<Invoice> {
  const res = await api.delete(`/invoices/${id}/lines/${lineId}`)
  return res.data.data
}

/** Numbers it, sets its due date and tells the owner. */
export async function issueInvoice(id: string): Promise<Invoice> {
  const res = await api.post(`/invoices/${id}/issue`)
  return res.data.data
}

export async function payInvoice(id: string, body: { method: PayMethod; reference?: string }): Promise<Invoice> {
  const res = await api.post(`/invoices/${id}/pay`, body)
  return res.data.data
}

export async function voidInvoice(id: string, reason?: string): Promise<Invoice> {
  const res = await api.post(`/invoices/${id}/void`, { reason })
  return res.data.data
}

export interface UpdateCompanyBilling {
  cycle?: "monthly" | "annual"
  /** "yyyy-MM-dd"; "" ends the trial. */
  trialEndsOn?: string
  /** Sets both; null = use the platform default. */
  prices?: { firstVenue: number | null; extraVenue: number | null }
  setupFeeWaived?: boolean
}

export async function updateCompanyBilling(ownerId: string, body: UpdateCompanyBilling) {
  const res = await api.patch(`/companies/${ownerId}/billing`, body)
  return res.data
}

/** Admin: stop a company working, or let it work again. */
export async function setCompanySuspension(ownerId: string, suspended: boolean, reason?: string) {
  const res = await api.patch(`/companies/${ownerId}/suspension`, { suspended, reason })
  return res.data
}

export type OnboardingKey = "venue" | "pitches" | "hours" | "cliq" | "staff" | "first_booking" | "customer" | "standing"

export interface Onboarding {
  steps: { key: OnboardingKey; done: boolean }[]
  done: number
  total: number
}

/** The owner's own checklist, or (admin) a company's. */
export async function getOnboarding(ownerId?: string): Promise<Onboarding> {
  const res = await api.get(ownerId ? `/companies/${ownerId}/onboarding` : "/companies/me/onboarding")
  return res.data.data
}
