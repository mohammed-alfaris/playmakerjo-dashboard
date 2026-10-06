import { http, HttpResponse, delay } from "msw"
import type { CompanyBilling, Invoice, InvoiceLine } from "@/api/billing"
import type { ActivityItem } from "@/api/activity"
import type { VenueLead, LeadStatus } from "@/api/leads"

/**
 * Batch 4 in mock mode: billing, invoices, suspension, onboarding, the activity log and the
 * leads pipeline. Kept apart from handlers.ts, which is already long; the company list there
 * reads `billingOf` so its rows carry the same billing this module changes.
 */
const BASE = import.meta.env.VITE_API_URL as string
const ok = (data: unknown, message = "OK", extra: Record<string, unknown> = {}) => HttpResponse.json({ success: true, data, message, ...extra })
const err = (message: string, status: number) => HttpResponse.json({ success: false, message }, { status })
const today = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10)

const billing: Record<string, CompanyBilling> = {}
export function billingOf(ownerId: string): CompanyBilling {
  return (billing[ownerId] ??= {
    status: "trial", cycle: "monthly", trialEndsOn: addDays(today(), 12),
    priceSmallVenue: 50, priceLargeVenue: 75, largeVenueMinPitches: 3, customPrices: false, setupFeeWaived: false,
    overdueCount: 0, overdueAmount: 0, suspendedAt: null, suspendedReason: null,
  })
}

const invoices: Invoice[] = []
let seq = 0

function refreshOverdue(ownerId: string) {
  const b = billingOf(ownerId)
  const late = invoices.filter((i) => i.ownerId === ownerId && i.status === "issued" && (i.dueOn ?? "9999") < today())
  late.forEach((i) => { i.overdue = true })
  b.overdueCount = late.length
  b.overdueAmount = late.reduce((s, i) => s + i.total, 0)
}

const activity: ActivityItem[] = [
  { id: 3, at: new Date(Date.now() - 3600_000).toISOString(), ownerId: "u2", actorName: "Tariq", actorRole: "venue_staff", action: "booking.cancelled", entityType: "booking", entityId: "b1", summary: "Cancelled Khalid · 2026-10-03 18:00, refunded 20 JOD|إلغاء Khalid · 2026-10-03 18:00، إعادة 20 JOD" },
  { id: 2, at: new Date(Date.now() - 7200_000).toISOString(), ownerId: "u2", actorName: "Khalid Al-Natour", actorRole: "venue_owner", action: "venue.updated", entityType: "venue", entityId: "v1", summary: "Changed Al-Ameen Football Arena: price 25 JOD to 30 JOD/h|تعديل Al-Ameen Football Arena: السعر من 25 JOD إلى 30 JOD/ساعة" },
  { id: 1, at: new Date(Date.now() - 86400_000).toISOString(), ownerId: "u2", actorName: "Khalid Al-Natour", actorRole: "venue_owner", action: "staff.added", entityType: "user", entityId: "u5", summary: "Added Tariq to the team|إضافة Tariq إلى الفريق" },
]

const leads: VenueLead[] = [
  { id: 1, contactName: "Omar Saleh", venueName: "Saleh Five-a-side", city: "Irbid", phone: "0791234567", email: "omar@example.com", sports: ["football"], createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(), status: "new", notes: null, nextFollowUpOn: today(), followUpDue: true, lostReason: null, convertedOwnerId: null, updatedAt: null },
  { id: 2, contactName: "Lina Haddad", venueName: "Haddad Padel", city: "Amman", phone: "0797654321", email: "lina@example.com", sports: ["padel"], createdAt: new Date(Date.now() - 12 * 86400_000).toISOString(), status: "demo", notes: "Demo went well; wants the annual price.", nextFollowUpOn: addDays(today(), 3), followUpDue: false, lostReason: null, convertedOwnerId: null, updatedAt: null },
]
const STAGES: LeadStatus[] = ["new", "contacted", "demo", "trial", "won", "lost"]

export const businessHandlers = [
  // ── Billing ─────────────────────────────────────────────────────────────
  http.get(`${BASE}/invoices`, async ({ request }) => {
    await delay(200)
    const url = new URL(request.url)
    const period = url.searchParams.get("period")
    const status = url.searchParams.get("status")
    // The mock admin is "u1"; everyone else sees only issued invoices, as an owner would.
    const ownerView = request.headers.get("Authorization") !== "Bearer mock-access-token-u1"
    let rows = invoices.filter((i) => !period || i.period === period)
    if (ownerView) rows = rows.filter((i) => i.status !== "draft")
    if (status === "overdue") rows = rows.filter((i) => i.overdue)
    else if (status) rows = rows.filter((i) => i.status === status)
    return ok(rows, "OK", { pagination: { page: 1, limit: 50, total: rows.length } })
  }),
  http.get(`${BASE}/invoices/:id`, async ({ params }) => {
    const inv = invoices.find((i) => i.id === params.id)
    return inv ? ok(inv) : err("Invoice not found", 404)
  }),
  http.post(`${BASE}/invoices/generate`, async ({ request }) => {
    await delay(400)
    const { period, ownerId } = (await request.json()) as { period: string; ownerId?: string }
    const owners = ownerId ? [ownerId] : ["u2", "u3"]
    const created: Invoice[] = []
    const skipped: { ownerId: string; companyName: string; reason: string }[] = []
    for (const id of owners) {
      const b = billingOf(id)
      if (invoices.some((i) => i.ownerId === id && i.period === period && i.status !== "void")) { skipped.push({ ownerId: id, companyName: id, reason: "already_invoiced" }); continue }
      if (b.status === "suspended") { skipped.push({ ownerId: id, companyName: id, reason: "suspended" }); continue }
      if (b.trialEndsOn && b.trialEndsOn >= `${period}-01`) { skipped.push({ ownerId: id, companyName: id, reason: "in_trial" }); continue }
      const lines: InvoiceLine[] = [
        { id: `il${++seq}`, kind: "subscription", description: `Monthly subscription (${period}): 1 venue(s) with up to 2 pitch(es)`, descriptionAr: `الاشتراك الشهري (${period}): 1 منشأة حتى 2 ملعب`, quantity: 1, unitPrice: b.priceSmallVenue, amount: b.priceSmallVenue },
      ]
      if (!b.setupFeeWaived && !invoices.some((i) => i.ownerId === id && i.status !== "void" && i.lines.some((l) => l.kind === "setup_fee")))
        lines.push({ id: `il${++seq}`, kind: "setup_fee", description: "Setup: data entry and training", descriptionAr: "رسوم التأسيس: إدخال البيانات والتدريب", quantity: 1, unitPrice: 100, amount: 100 })
      const inv: Invoice = {
        id: `inv_mock_${++seq}`, number: null, ownerId: id, companyName: id === "u2" ? "Khalid Al-Natour" : "Rami Sports",
        period, status: "draft", overdue: false, total: lines.reduce((s, l) => s + l.amount, 0),
        createdAt: new Date().toISOString(), lines,
      }
      invoices.unshift(inv)
      created.push(inv)
    }
    return ok({ period, created, skipped }, `${created.length} draft invoice(s) created`)
  }),
  http.post(`${BASE}/invoices/:id/lines`, async ({ params, request }) => {
    const inv = invoices.find((i) => i.id === params.id)
    if (!inv) return err("Invoice not found", 404)
    if (inv.status !== "draft") return err("Only a draft can be changed.", 400)
    const b = (await request.json()) as { description: string; amount: number }
    inv.lines.push({ id: `il${++seq}`, kind: "adjustment", description: b.description, quantity: 1, unitPrice: b.amount, amount: b.amount })
    inv.total = inv.lines.reduce((s, l) => s + l.amount, 0)
    return ok(inv)
  }),
  http.delete(`${BASE}/invoices/:id/lines/:lineId`, async ({ params }) => {
    const inv = invoices.find((i) => i.id === params.id)
    if (!inv) return err("Invoice not found", 404)
    inv.lines = inv.lines.filter((l) => l.id !== params.lineId)
    inv.total = inv.lines.reduce((s, l) => s + l.amount, 0)
    return ok(inv)
  }),
  http.post(`${BASE}/invoices/:id/issue`, async ({ params }) => {
    const inv = invoices.find((i) => i.id === params.id)
    if (!inv || inv.status !== "draft") return err("This invoice has already been issued", 400)
    const n = invoices.filter((i) => i.number).length + 1
    Object.assign(inv, { status: "issued", number: `PMJ-${today().slice(0, 4)}-${String(n).padStart(4, "0")}`, issuedAt: new Date().toISOString(), dueOn: addDays(today(), 14) })
    return ok(inv, `Invoice ${inv.number} issued`)
  }),
  http.post(`${BASE}/invoices/:id/pay`, async ({ params, request }) => {
    const inv = invoices.find((i) => i.id === params.id)
    if (!inv || inv.status !== "issued") return err("Only an issued invoice can be marked paid", 400)
    const b = (await request.json()) as { method: Invoice["paidMethod"]; reference?: string }
    Object.assign(inv, { status: "paid", overdue: false, paidAt: new Date().toISOString(), paidMethod: b.method, paidReference: b.reference ?? null })
    refreshOverdue(inv.ownerId)
    return ok(inv, "Payment recorded")
  }),
  http.post(`${BASE}/invoices/:id/void`, async ({ params, request }) => {
    const inv = invoices.find((i) => i.id === params.id)
    if (!inv || inv.status === "paid" || inv.status === "void") return err("This invoice cannot be voided", 400)
    const b = (await request.json().catch(() => ({}))) as { reason?: string }
    Object.assign(inv, { status: "void", overdue: false, voidReason: b.reason ?? null })
    refreshOverdue(inv.ownerId)
    return ok(inv, "Invoice voided")
  }),
  http.patch(`${BASE}/companies/:ownerId/billing`, async ({ params, request }) => {
    const b = billingOf(String(params.ownerId))
    const body = (await request.json()) as { cycle?: "monthly" | "annual"; trialEndsOn?: string; prices?: { smallVenue: number | null; largeVenue: number | null }; setupFeeWaived?: boolean }
    if (body.cycle) b.cycle = body.cycle
    if (body.trialEndsOn !== undefined) b.trialEndsOn = body.trialEndsOn || null
    if (body.prices) {
      b.customPrices = body.prices.smallVenue != null || body.prices.largeVenue != null
      b.priceSmallVenue = body.prices.smallVenue ?? 50
      b.priceLargeVenue = body.prices.largeVenue ?? 75
    }
    if (body.setupFeeWaived !== undefined) b.setupFeeWaived = body.setupFeeWaived
    if (b.status !== "suspended") b.status = b.trialEndsOn && b.trialEndsOn >= today() ? "trial" : "active"
    return ok(null, "Billing updated")
  }),
  http.patch(`${BASE}/companies/:ownerId/suspension`, async ({ params, request }) => {
    const b = billingOf(String(params.ownerId))
    const body = (await request.json()) as { suspended: boolean; reason?: string }
    b.suspendedAt = body.suspended ? new Date().toISOString() : null
    b.suspendedReason = body.suspended ? body.reason ?? null : null
    b.status = body.suspended ? "suspended" : b.trialEndsOn && b.trialEndsOn >= today() ? "trial" : "active"
    return ok(null, body.suspended ? "Company suspended" : "Company restored")
  }),

  // ── Onboarding ──────────────────────────────────────────────────────────
  ...["/companies/me/onboarding", "/companies/:ownerId/onboarding"].map((path) =>
    http.get(`${BASE}${path}`, async () => {
      await delay(150)
      const steps = [
        { key: "venue", done: true }, { key: "pitches", done: true }, { key: "hours", done: true }, { key: "cliq", done: true },
        { key: "staff", done: false }, { key: "first_booking", done: true }, { key: "customer", done: true }, { key: "standing", done: false },
      ]
      return ok({ steps, done: steps.filter((s) => s.done).length, total: steps.length })
    })),

  // ── Activity ────────────────────────────────────────────────────────────
  http.get(`${BASE}/activity`, async ({ request }) => {
    await delay(200)
    const area = new URL(request.url).searchParams.get("area")
    const rows = activity.filter((e) => !area || e.action.startsWith(`${area}.`))
    return ok(rows, "OK", { pagination: { page: 1, limit: 50, total: rows.length } })
  }),

  // ── Leads ───────────────────────────────────────────────────────────────
  http.get(`${BASE}/waitlist/venues/stats`, async () =>
    ok({
      byStatus: Object.fromEntries(STAGES.map((s) => [s, leads.filter((l) => l.status === s).length])),
      followUpsDue: leads.filter((l) => l.followUpDue).length,
    })),
  http.get(`${BASE}/waitlist/venues`, async ({ request }) => {
    await delay(200)
    const status = new URL(request.url).searchParams.get("status")
    const rows = leads.filter((l) => !status || (status === "due" ? l.followUpDue : l.status === status))
    return ok(rows.map(({ sports, ...l }) => ({ ...l, sportsJson: JSON.stringify(sports) })), "OK", { pagination: { page: 1, limit: 50, total: rows.length } })
  }),
  http.patch(`${BASE}/waitlist/venues/:id`, async ({ params, request }) => {
    const lead = leads.find((l) => l.id === Number(params.id))
    if (!lead) return err("Lead not found", 404)
    const b = (await request.json()) as Partial<VenueLead>
    if (b.status) lead.status = b.status
    if (b.notes !== undefined) lead.notes = b.notes || null
    if (b.nextFollowUpOn !== undefined) lead.nextFollowUpOn = b.nextFollowUpOn || null
    if (b.lostReason !== undefined) lead.lostReason = b.lostReason
    if (b.convertedOwnerId) { lead.convertedOwnerId = b.convertedOwnerId; lead.status = "won" }
    if (lead.status === "won" || lead.status === "lost") lead.nextFollowUpOn = null
    lead.followUpDue = !!lead.nextFollowUpOn && lead.nextFollowUpOn <= today()
    return ok(lead, "Lead updated")
  }),
]
