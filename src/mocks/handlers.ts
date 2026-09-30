import { http, HttpResponse, delay } from "msw"
import {
  mockUsers,
  mockVenues,
  mockBookings,
  mockPayments,
  mockSummary,
  mockRevenueChart,
  mockTopVenues,
  mockSportsBreakdown,
  mockCustomers,
  mockVenueFeatures,
  mockStaffRoles,
} from "./data"
import type { Booking, RefundChoice } from "@/api/bookings"
import { billingOf, businessHandlers } from "./businessHandlers"
import { cancelPreview, refundFor } from "@/lib/cancellation"

const BASE = import.meta.env.VITE_API_URL as string

// Mutable copies so POST/PATCH/DELETE mutations persist during the session
let users = [...mockUsers]
let venues = [...mockVenues]
let venueFeatures = [...mockVenueFeatures]
const bookings = [...mockBookings]
const payments = [...mockPayments]

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Blocked time created in this session. */
const mockBlocks: { id: string; venueId: string; pitchId: string | null; startsAt: string; endsAt: string; reason: string | null; createdAt: string }[] = []

function minToHHMM(min: number) {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/** A refund or correction: a negative ledger row, and the booking's paid amount comes down. */
function moneyBack(b: Record<string, unknown>, amount: number, kind: "refund" | "correction", note?: string) {
  b.amountPaid = Math.round((Number(b.amountPaid ?? 0) - amount) * 1000) / 1000
  if (Number(b.amountPaid) <= 0) b.depositPaid = false
  payments.unshift({
    id: `pay-${String(b.id)}-${kind}-${Date.now().toString(36)}`,
    bookingRef: String(b.id),
    player: b.player,
    customer: b.customer,
    payerName: (b.customer as { name?: string } | null)?.name ?? (b.player as { name: string }).name,
    recordedBy: { id: "u2", name: "Khalid Al-Natour" },
    venue: b.venue,
    status: "paid",
    amount: -amount,
    method: String(b.paymentMethod ?? "cash"),
    kind,
    note: note ?? null,
    date: new Date().toISOString(),
  } as never)
}

function paginate<T>(arr: T[], page = 1, limit = 20) {
  const start = (page - 1) * limit
  return {
    data: arr.slice(start, start + limit),
    pagination: { page, limit, total: arr.length },
  }
}

function ok(data: unknown, message = "OK", extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ success: true, data, message, ...extra })
}

function err(message: string, status: number) {
  return HttpResponse.json({ success: false, message }, { status })
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
const MOCK_PASSWORDS: Record<string, string> = {
  "admin@sportsvenue.jo": "mock-password",
  "khalid@venues.jo":     "mock-password",
  // venue_staff can log in now — the counter clerk is a real user of this product.
  "tariq@staff.jo":       "mock-password",   // write
  "dina@staff.jo":        "mock-password",   // read
}

const authHandlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as { email: string; password: string }

    const user = mockUsers.find((u) => u.email === body.email)
    if (!user || MOCK_PASSWORDS[user.email] !== body.password) {
      return err("Invalid email or password", 401)
    }

    // The token carries the user id so /users/me can answer for whoever signed in.
    return ok(
      { user, accessToken: `mock-access-token-${user.id}` },
      "Login successful"
    )
  }),

  http.post(`${BASE}/auth/refresh`, async () => {
    await delay(200)
    return ok({ accessToken: "mock-access-token-refreshed" })
  }),

  http.post(`${BASE}/auth/logout`, async () => {
    await delay(200)
    return ok(null, "Logged out")
  }),
]

// ─── Dashboard / Reports ──────────────────────────────────────────────────────
const reportHandlers = [
  http.get(`${BASE}/reports/summary`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const ownerId = url.searchParams.get("owner_id")

    if (ownerId) {
      const ownerVenues   = mockVenues.filter((v) => v.owner.id === ownerId)
      const ownerVenueIds = ownerVenues.map((v) => v.id)
      const ownerBookings = bookings.filter((b) => ownerVenueIds.includes(b.venue.id))
      const ownerRevenue  = ownerBookings
        .filter((b) => b.status === "completed")
        .reduce((s, b) => s + b.amount, 0)
      return ok({
        totalVenues:    ownerVenues.length,
        totalBookings:  ownerBookings.length,
        totalRevenue:   ownerRevenue,
        totalUsers:     0,
        revenueChange:  0,
        bookingsChange: 0,
        venuesChange:   0,
        usersChange:    0,
      })
    }

    return ok(mockSummary)
  }),

  http.get(`${BASE}/reports/revenue-chart`, async () => {
    await delay(400)
    return ok(mockRevenueChart)
  }),

  http.get(`${BASE}/reports/top-venues`, async ({ request }) => {
    await delay(300)
    // The real API derives the owner from the JWT. Unscoped, this endpoint was a named
    // competitor revenue leaderboard rendered on the owner's own home screen — so the mock
    // scopes it too, otherwise the demo misrepresents the security posture.
    const ownerId = new URL(request.url).searchParams.get("owner_id")
    if (!ownerId) return ok(mockTopVenues)

    const ownVenueIds = mockVenues.filter((v) => v.owner.id === ownerId).map((v) => v.id)
    return ok(mockTopVenues.filter((v) => ownVenueIds.includes(v.id)))
  }),

  http.get(`${BASE}/reports/sports-breakdown`, async () => {
    await delay(300)
    return ok(mockSportsBreakdown)
  }),

  http.get(`${BASE}/reports/export`, async ({ request }) => {
    await delay(600)
    const url = new URL(request.url)
    const format = url.searchParams.get("format") ?? "csv"
    const content = format === "csv"
      ? "id,venue,player,amount,status\n1,Al-Ameen,Faisal,50,paid"
      : "%PDF-1.4 mock pdf content"
    return new HttpResponse(content, {
      headers: {
        "Content-Type": format === "csv" ? "text/csv" : "application/pdf",
        "Content-Disposition": `attachment; filename="report.${format}"`,
      },
    })
  }),
]

// ─── Venues ──────────────────────────────────────────────────────────────────
const venueHandlers = [
  http.get(`${BASE}/venues`, async ({ request }) => {
    await delay(400)
    const url = new URL(request.url)
    const page  = Number(url.searchParams.get("page"))  || 1
    const limit = Number(url.searchParams.get("limit")) || 20
    const search = (url.searchParams.get("search") ?? "").toLowerCase()
    const sport  = url.searchParams.get("sport")  ?? ""
    const status = url.searchParams.get("status") ?? ""

    const ownerId = url.searchParams.get("owner_id") ?? ""

    let filtered = venues
    if (search)  filtered = filtered.filter(v => v.name.toLowerCase().includes(search) || v.city.toLowerCase().includes(search))
    if (sport)   filtered = filtered.filter(v => v.sports.includes(sport))
    if (status)  filtered = filtered.filter(v => v.status === status)
    if (ownerId) filtered = filtered.filter(v => v.owner.id === ownerId)

    const { data, pagination } = paginate(filtered, page, limit)
    return HttpResponse.json({ success: true, data, message: "OK", pagination })
  }),

  http.post(`${BASE}/venues`, async ({ request }) => {
    await delay(500)
    const body = withResolvedFeatures(await request.json() as Record<string, unknown>)
    const me = caller(request)
    const ownerId = me?.role === "venue_owner" ? me.id : (body.owner_id as string | undefined)
    const full = ownerId ? venueLimitMessage(ownerId) : null
    if (full) return err(full, 409)
    const owner = users.find((u) => u.id === ownerId)
    const newVenue = {
      id: `v${Date.now()}`, status: "active", createdAt: new Date().toISOString(),
      ...(owner ? { owner: { id: owner.id, name: owner.name } } : {}),
      ...body,
    }
    venues = [newVenue as typeof venues[0], ...venues]
    return ok(newVenue, "Venue created")
  }),

  http.get(`${BASE}/venues/:id/stats`, async ({ params }) => {
    await delay(300)
    const venueBookings = bookings.filter(b => b.venue.id === params.id)
    const totalRevenue  = venueBookings.filter(b => b.status === "completed").reduce((s, b) => s + b.amount, 0)
    const venue = venues.find(v => v.id === params.id)
    return ok({ totalBookings: venueBookings.length, totalRevenue, activeSince: venue?.createdAt ?? "" })
  }),

  http.get(`${BASE}/venues/:id`, async ({ params }) => {
    await delay(300)
    const venue = venues.find(v => v.id === params.id)
    if (!venue) return err("Venue not found", 404)
    return ok(venue)
  }),

  http.patch(`${BASE}/venues/:id`, async ({ params, request }) => {
    await delay(400)
    const body = withResolvedFeatures(await request.json() as Record<string, unknown>)
    venues = venues.map(v => v.id === params.id ? { ...v, ...body } : v)
    const updated = venues.find(v => v.id === params.id)
    return ok(updated, "Venue updated")
  }),

  http.delete(`${BASE}/venues/:id`, async ({ params }) => {
    await delay(400)
    venues = venues.filter(v => v.id !== params.id)
    return ok(null, "Venue deleted")
  }),
]

// ─── Users ────────────────────────────────────────────────────────────────────
const userHandlers = [
  http.get(`${BASE}/users`, async ({ request }) => {
    await delay(400)
    const url = new URL(request.url)
    const page   = Number(url.searchParams.get("page"))  || 1
    const limit  = Number(url.searchParams.get("limit")) || 20
    const role   = url.searchParams.get("role")   ?? ""
    const search = (url.searchParams.get("search") ?? "").toLowerCase()

    let filtered = users
    if (role)   filtered = filtered.filter(u => u.role === role)
    if (search) filtered = filtered.filter(u =>
      u.name.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search)
    )

    const { data, pagination } = paginate(filtered, page, limit)
    return HttpResponse.json({ success: true, data, message: "OK", pagination })
  }),

  http.post(`${BASE}/users/:id/reset-password`, async ({ params }) => {
    await delay(400)
    const user = users.find(u => u.id === params.id)
    if (!user) return HttpResponse.json({ success: false, message: "User not found" }, { status: 404 })
    // Shaped like the server's generator: no O/0, I/l/1, S/5 or B/8, because this value's
    // whole life is being read down a phone. Not cryptographic — this is the mock.
    const alphabet = "ABCDEFGHJKMNPQRTUVWXYZabcdefghijkmnpqrtuvwxyz234679"
    const temporaryPassword = Array.from(
      { length: 14 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("")
    return ok({ userId: user.id, email: user.email, temporaryPassword },
      "Password reset. Give this password to the user — it is shown only once.")
  }),

  http.patch(`${BASE}/users/:id/status`, async ({ params, request }) => {
    await delay(400)
    const body = await request.json() as { status: string }
    // Bringing a suspended clerk back takes a seat, so it is checked like hiring.
    const target = users.find(u => u.id === params.id) as MockUser | undefined
    if (target?.role === "venue_staff" && target.status !== "active" && body.status === "active" && target.managedByOwnerId) {
      const full = staffLimitMessage(target.managedByOwnerId)
      if (full) return err(full, 409)
    }
    users = users.map(u => u.id === params.id ? { ...u, status: body.status as "active" | "banned" } : u)
    return ok(users.find(u => u.id === params.id), "Status updated")
  }),

  http.patch(`${BASE}/users/:id/role`, async ({ params, request }) => {
    await delay(400)
    const body = await request.json() as { role: string }
    users = users.map(u => u.id === params.id ? { ...u, role: body.role } : u)
    return ok(users.find(u => u.id === params.id), "Role updated")
  }),

  http.patch(`${BASE}/users/:id/avatar`, async ({ params, request }) => {
    await delay(300)
    const body = await request.json() as { avatar: string }
    users = users.map(u => u.id === params.id ? { ...u, avatar: body.avatar } : u)
    return ok(users.find(u => u.id === params.id), "Avatar updated")
  }),
]

// ─── Staff (owner's own team) ─────────────────────────────────────────────────
// The real API derives the owner from the JWT and ignores any client-supplied id. The
// mock stands in the owner whose team is seeded (u2 Khalid).
const MOCK_OWNER_ID = "u2"

type MockUser = (typeof users)[number] & {
  managedByOwnerId?: string
  staffRole?: { id: string; name: string } | null
  allVenues?: boolean
  venueIds?: string[]
}

let staffRoles = [...mockStaffRoles]
const ALL_PERMISSIONS = mockStaffRoles[0].permissions.concat("reports.view")

/** Who is calling, from the mock token; a refreshed token loses it and falls back to the owner. */
function caller(request: Request): MockUser | undefined {
  const token = request.headers.get("Authorization")?.replace("Bearer mock-access-token-", "") ?? ""
  return (users.find((u) => u.id === token) ?? users.find((u) => u.id === MOCK_OWNER_ID)) as MockUser | undefined
}

function roleCounts() {
  const counts: Record<string, number> = {}
  for (const u of users as MockUser[]) {
    if (u.role === "venue_staff" && u.staffRole) counts[u.staffRole.id] = (counts[u.staffRole.id] ?? 0) + 1
  }
  return counts
}

function roleDto(r: (typeof staffRoles)[number]) {
  return { id: r.id, name: r.name, permissions: r.permissions, staffCount: roleCounts()[r.id] ?? 0 }
}

/** Mirrors the server: anything beyond seeing an area also grants seeing it. */
function normalizePermissions(ps: string[]) {
  const set = new Set(ps)
  for (const p of ps) if (!p.endsWith(".view")) set.add(`${p.split(".")[0]}.view`)
  return ALL_PERMISSIONS.filter((p) => set.has(p))
}

function accessOf(u: MockUser) {
  if (u.role === "venue_staff") {
    const role = staffRoles.find((r) => r.id === u.staffRole?.id)
    return {
      companyId: u.managedByOwnerId ?? null,
      companyName: users.find((o) => o.id === u.managedByOwnerId)?.name ?? null,
      staffRole: role ? { id: role.id, name: role.name } : null,
      permissions: role?.permissions ?? [],
      allVenues: u.allVenues ?? true,
      venueIds: u.allVenues === false ? (u.venueIds ?? []) : [],
    }
  }
  return {
    companyId: u.role === "venue_owner" ? u.id : null,
    companyName: u.role === "venue_owner" ? u.name : null,
    permissions: ALL_PERMISSIONS,
    allVenues: true,
    venueIds: [],
  }
}

const staffHandlers = [
  http.get(`${BASE}/users/staff`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page")) || 1
    const limit = Number(url.searchParams.get("limit")) || 20

    const staff = users.filter(
      (u) => u.role === "venue_staff" && (u as { managedByOwnerId?: string }).managedByOwnerId === MOCK_OWNER_ID,
    )
    const { data, pagination } = paginate(staff, page, limit)
    return HttpResponse.json({ success: true, data, message: "OK", pagination })
  }),

  http.get(`${BASE}/users/me`, async ({ request }) => {
    await delay(150)
    const me = caller(request)
    if (!me) return err("Unauthorized", 401)
    return ok({ ...me, access: accessOf(me) })
  }),

  http.post(`${BASE}/users`, async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as Record<string, unknown>
    if (users.some((u) => u.email === body.email)) return err("Email already in use", 400)
    const companyId = (body.managedByOwnerId as string | undefined) ?? MOCK_OWNER_ID
    if (body.role === "venue_staff") {
      const full = staffLimitMessage(companyId)
      if (full) return err(full, 409)
    }
    const role = staffRoles.find((r) => r.id === body.staffRoleId)
    const user = {
      id: `u${Date.now()}`, name: String(body.name), email: String(body.email), phone: String(body.phone ?? ""),
      role: String(body.role ?? "venue_staff"), status: "active" as const, avatar: "", createdAt: new Date().toISOString(),
      permissions: "read", managedByOwnerId: body.role === "venue_staff" ? companyId : undefined,
      staffRole: role ? { id: role.id, name: role.name } : null,
      allVenues: body.allVenues !== false,
      venueIds: body.allVenues === false ? ((body.venueIds as string[]) ?? []) : [],
    }
    users = [...users, user as (typeof users)[number]]
    return ok(user, "User created")
  }),

  http.patch(`${BASE}/users/:id/staff`, async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as { staffRoleId?: string; allVenues?: boolean; venueIds?: string[] }
    const user = users.find((u) => u.id === params.id) as MockUser | undefined
    if (!user || user.role !== "venue_staff") return err("Staff account not found", 404)
    if (body.staffRoleId) {
      const role = staffRoles.find((r) => r.id === body.staffRoleId)
      if (!role) return err("That role does not exist.", 400)
      user.staffRole = { id: role.id, name: role.name }
    }
    if (body.allVenues === true) {
      user.allVenues = true
      user.venueIds = []
    } else if (body.allVenues === false) {
      if (!body.venueIds?.length) return err("Choose at least one venue, or give access to all venues.", 400)
      user.allVenues = false
      user.venueIds = body.venueIds
    }
    return ok(user, "Staff updated")
  }),

  http.get(`${BASE}/staff-roles`, async () => {
    await delay(200)
    return ok(staffRoles.filter((r) => r.ownerId === MOCK_OWNER_ID).map(roleDto))
  }),

  http.post(`${BASE}/staff-roles`, async ({ request }) => {
    await delay(300)
    const body = (await request.json()) as { name?: string; permissions?: string[] }
    const name = (body.name ?? "").trim()
    if (!name) return err("A role needs a name.", 400)
    if (staffRoles.some((r) => r.ownerId === MOCK_OWNER_ID && r.name === name)) {
      return err("You already have a role with that name.", 409)
    }
    const role = { id: `sr_${Date.now()}`, ownerId: MOCK_OWNER_ID, name, permissions: normalizePermissions(body.permissions ?? []) }
    staffRoles = [...staffRoles, role]
    return ok(roleDto(role), "Role created")
  }),

  http.patch(`${BASE}/staff-roles/:id`, async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as { name?: string; permissions?: string[] }
    const role = staffRoles.find((r) => r.id === params.id)
    if (!role) return err("Role not found", 404)
    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name) return err("A role needs a name.", 400)
      if (staffRoles.some((r) => r.ownerId === role.ownerId && r.name === name && r.id !== role.id)) {
        return err("You already have a role with that name.", 409)
      }
      role.name = name
      for (const u of users as MockUser[]) if (u.staffRole?.id === role.id) u.staffRole = { id: role.id, name }
    }
    if (body.permissions) role.permissions = normalizePermissions(body.permissions)
    return ok(roleDto(role), "Role updated")
  }),

  http.delete(`${BASE}/staff-roles/:id`, async ({ params }) => {
    await delay(300)
    const inUse = roleCounts()[String(params.id)] ?? 0
    if (inUse > 0) return err(`${inUse} staff member(s) have this role. Give them another role first.`, 409)
    staffRoles = staffRoles.filter((r) => r.id !== params.id)
    return ok(null, "Role deleted")
  }),

  http.patch(`${BASE}/users/:id/permissions`, async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as { permissions?: string }
    if (body.permissions !== "read" && body.permissions !== "write") {
      return err("permissions must be 'read' or 'write'", 400)
    }
    const user = users.find((u) => u.id === params.id) as Record<string, unknown> | undefined
    if (!user || user.role !== "venue_staff") return err("Staff account not found", 404)

    user.permissions = body.permissions
    return ok(user, "Permissions updated")
  }),
]

// ─── Inbox (the signed-in user's own notifications) ───────────────────────────
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
let inbox = [
  { id: "n1", title: "New booking|حجز جديد", body: "Faisal Al-Zoubi booked Al-Ameen Football Arena for tonight 20:00.|فيصل الزعبي حجز ملعب الأمين الليلة 20:00.", type: "new_booking", referenceId: "b10", isRead: false, createdAt: minutesAgo(4) },
  { id: "n2", title: "Payment Proof Received|تم استلام إثبات الدفع", body: "A payment proof has been uploaded by Nour Khalil.|تم رفع إثبات دفع من قبل نور خليل.", type: "proof_received", referenceId: "b8", isRead: false, createdAt: minutesAgo(38) },
  { id: "n3", title: "Booking Cancelled|تم إلغاء الحجز", body: "Hassan Khatib cancelled his booking.|حسن الخطيب ألغى حجزه.", type: "booking_cancelled", referenceId: "b4", isRead: true, createdAt: minutesAgo(60 * 26) },
]

const inboxHandlers = [
  http.get(`${BASE}/notifications`, async () => {
    await delay(150)
    return ok({ notifications: inbox, unreadCount: inbox.filter((n) => !n.isRead).length })
  }),
  http.get(`${BASE}/notifications/unread-count`, async () => ok({ unreadCount: inbox.filter((n) => !n.isRead).length })),
  http.patch(`${BASE}/notifications/:id/read`, async ({ params }) => {
    inbox = inbox.map((n) => (n.id === params.id ? { ...n, isRead: true } : n))
    return ok(null, "Marked as read")
  }),
  http.post(`${BASE}/notifications/read-all`, async () => {
    inbox = inbox.map((n) => ({ ...n, isRead: true }))
    return ok(null, "All marked as read")
  }),
]

// ─── Business reports ─────────────────────────────────────────────────────────
// The seeded bookings are all from March 2025, so a real computation over "this month" would
// show an empty report. These handlers instead generate steady, repeatable demo numbers for
// whatever period is asked — the same date always gives the same figures.

function seeded(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

function reportDates(url: URL) {
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
  const from = url.searchParams.get("from") ?? `${today.slice(0, 7)}-01`
  const to = url.searchParams.get("to") ?? today
  const dates: string[] = []
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1))
    dates.push(d.toISOString().slice(0, 10))
  const compare = url.searchParams.get("compare") === "true"
  const prevEnd = new Date(`${from}T00:00:00Z`); prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setUTCDate(prevStart.getUTCDate() - dates.length + 1)
  return {
    dates, compare,
    period: {
      from, to, days: dates.length,
      previousFrom: compare ? prevStart.toISOString().slice(0, 10) : null,
      previousTo: compare ? prevEnd.toISOString().slice(0, 10) : null,
    },
  }
}

const r3 = (n: number) => Math.round(n * 1000) / 1000
const kpi = (value: number, compare: boolean, seed: string) =>
  ({ value: r3(value), previous: compare ? r3(value * (0.75 + seeded(seed) * 0.4)) : null })

function mockDay(date: string, venueId = "") {
  const weekend = [4, 5].includes(new Date(`${date}T00:00:00Z`).getUTCDay()) // Thu/Fri evenings
  const k = date + venueId
  const bookings = Math.round((weekend ? 14 : 8) + seeded(k + "b") * 6)
  return {
    cash: r3(bookings * 14 * (0.6 + seeded(k + "c") * 0.3)),
    cliq: r3(bookings * 14 * (0.2 + seeded(k + "q") * 0.2)),
    other: 0,
    booked: bookings * 25,
    app: Math.round(bookings * 0.45), counter: Math.round(bookings * 0.4),
    weekly: Math.round(bookings * 0.15), series: 0,
    cancelled: Math.round(seeded(k + "x") * 3),
  }
}

const reportHandlers2 = [
  http.get(`${BASE}/reports/money`, async ({ request }) => {
    await delay(250)
    const url = new URL(request.url)
    const { dates, compare, period } = reportDates(url)
    const venueId = url.searchParams.get("venue_id") ?? ""
    const daily = dates.map((d) => ({ date: d, ...mockDay(d, venueId) }))
    const collected = daily.reduce((s, d) => s + d.cash + d.cliq, 0)
    const booked = daily.reduce((s, d) => s + d.booked, 0)
    const cash = daily.reduce((s, d) => s + d.cash, 0)
    const ownVenues = venues.filter((v) => v.owner.id === MOCK_OWNER_ID && (!venueId || v.id === venueId))
    return ok({
      period,
      collected: kpi(collected, compare, "col" + period.from),
      booked: kpi(booked, compare, "bk" + period.from),
      outstanding: 85, outstandingCount: 3,
      platformFee: null, net: null,
      byMethod: [
        { key: "cash", amount: r3(cash), count: Math.round(cash / 20) },
        { key: "cliq", amount: r3(collected - cash), count: Math.round((collected - cash) / 20) },
      ],
      byKind: [
        { key: "full", amount: r3(collected * 0.55), count: 40 },
        { key: "deposit", amount: r3(collected * 0.25), count: 25 },
        { key: "balance", amount: r3(collected * 0.2), count: 18 },
      ],
      daily: daily.map(({ date, cash, cliq, other, booked }) => ({ date, cash, cliq, other, booked })),
      byVenue: ownVenues.map((v, i) => ({
        venueId: v.id, name: v.name, nameAr: null,
        collected: r3(collected / (i + 1.6)), booked: r3(booked / (i + 1.6)), bookings: Math.round(booked / 25 / (i + 1.6)),
      })),
      byPitch: ownVenues.map((v, i) => ({
        venueId: v.id, venueName: v.name, pitchId: `p-${v.id}`, pitchName: `Pitch ${i + 1}`, pitchNameAr: null,
        booked: r3(booked / (i + 1.6)), bookings: Math.round(booked / 25 / (i + 1.6)),
      })),
      outstandingItems: [
        { bookingId: "b7", date: dates[0], startTime: "19:00", venueName: "Al-Ameen Football Arena", customerId: null, customerName: "Hassan Khatib", customerPhone: "+962791000012", total: 50, paid: 10, owed: 40 },
        { bookingId: "b8", date: dates[0], startTime: "21:00", venueName: "Aqaba Beach Sports", customerId: null, customerName: "Maya Shawabkeh", customerPhone: "+962791000013", total: 44, paid: 14, owed: 30 },
        { bookingId: "b9", date: dates[0], startTime: "18:00", venueName: "Al-Ameen Football Arena", customerId: null, customerName: "Sara Nimri", customerPhone: "+962791000011", total: 25, paid: 10, owed: 15 },
      ],
    })
  }),

  http.get(`${BASE}/reports/bookings`, async ({ request }) => {
    await delay(250)
    const url = new URL(request.url)
    const { dates, compare, period } = reportDates(url)
    const daily = dates.map((d) => {
      const m = mockDay(d, url.searchParams.get("venue_id") ?? "")
      return { date: d, app: m.app, counter: m.counter, weekly: m.weekly, series: m.series, cancelled: m.cancelled }
    })
    const sum = (k: "app" | "counter" | "weekly" | "series" | "cancelled") => daily.reduce((s, d) => s + d[k], 0)
    const live = sum("app") + sum("counter") + sum("weekly")
    const cancelled = sum("cancelled")
    return ok({
      period,
      bookings: kpi(live, compare, "bn" + period.from),
      cancelRate: kpi(Math.round((cancelled * 1000) / (live + cancelled)) / 10, compare, "cr" + period.from),
      noShowRate: kpi(4.2, compare, "ns" + period.from),
      attended: Math.round(live * 0.8), noShows: Math.round(live * 0.03),
      cancelledByPerson: Math.round(cancelled * 0.6), cancelledExpired: cancelled - Math.round(cancelled * 0.6),
      byStatus: [{ key: "completed", count: Math.round(live * 0.5) }, { key: "confirmed", count: Math.round(live * 0.5) }, { key: "cancelled", count: cancelled }],
      byChannel: [
        { key: "app", count: sum("app") }, { key: "counter", count: sum("counter") }, { key: "weekly", count: sum("weekly") },
      ],
      daily,
      leadTime: [
        { key: "same_day", count: Math.round(live * 0.35) }, { key: "1_2_days", count: Math.round(live * 0.4) },
        { key: "3_7_days", count: Math.round(live * 0.2) }, { key: "8_plus_days", count: Math.round(live * 0.05) },
      ],
      sports: [{ key: "football", count: Math.round(live * 0.7) }, { key: "basketball", count: Math.round(live * 0.2) }, { key: "padel", count: Math.round(live * 0.1) }],
    })
  }),

  http.get(`${BASE}/reports/occupancy`, async ({ request }) => {
    await delay(250)
    const url = new URL(request.url)
    const { compare, period } = reportDates(url)
    const grid = []
    let open = 0, booked = 0
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
      const isOpen = h >= 8 && h <= 23
      const peak = h >= 18 && h <= 22 ? 0.75 : h >= 16 ? 0.45 : 0.15
      const weekend = d === 4 || d === 5 ? 0.15 : 0
      const pct = isOpen ? Math.min(100, Math.round((peak + weekend + seeded(`${d}-${h}`) * 0.15) * 1000) / 10) : null
      const o = isOpen ? period.days / 7 * 3 : 0
      grid.push({ day: d, hour: h, openHours: o, bookedHours: pct == null ? 0 : o * pct / 100, pct })
      open += o; booked += pct == null ? 0 : o * pct / 100
    }
    const open_ = grid.filter((c) => c.pct != null)
    const byPct = [...open_].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
    return ok({
      period,
      occupancy: { value: Math.round((booked * 1000) / open) / 10, previous: compare ? 38.4 : null },
      openHours: Math.round(open), bookedHours: Math.round(booked),
      grid,
      byPitch: venues.filter((v) => v.owner.id === MOCK_OWNER_ID).map((v, i) => ({
        venueId: v.id, venueName: v.name, pitchId: `p-${v.id}`, pitchName: `Pitch ${i + 1}`, pitchNameAr: null,
        openHours: Math.round(open / 3), bookedHours: Math.round(booked / 3 / (1 + i * 0.3)),
        pct: Math.round((1000 * booked) / open / (1 + i * 0.3)) / 10,
      })),
      busiest: byPct.slice(0, 5),
      quietest: byPct.slice(-5).reverse(),
    })
  }),

  http.get(`${BASE}/reports/customers`, async ({ request }) => {
    await delay(250)
    const url = new URL(request.url)
    const { compare, period } = reportDates(url)
    const me = caller(request)
    const top = mockCustomers.slice(0, 6).map((c, i) => ({ id: c.id, name: c.name, phone: c.phone, visits: 9 - i, paid: 180 - i * 22 }))
    return ok({
      period,
      customers: me?.role === "venue_staff" && !accessOf(me).permissions.includes("customers.view") ? null : {
        active: kpi(64, compare, "ac" + period.from), new: kpi(17, compare, "nc" + period.from),
        returning: 47, returnRate: 73.4, lapsed: 6,
        topByVisits: top, topBySpend: [...top].sort((a, b) => b.paid - a.paid),
      },
      team: me?.role === "venue_staff" ? null : [
        { userId: MOCK_OWNER_ID, name: "Khalid Al-Natour", role: "venue_owner", payments: 38, collected: 912, cash: 700, cliq: 212, counterBookings: 22 },
        { userId: "u6", name: "Tariq Mansour", role: "venue_staff", payments: 51, collected: 1184, cash: 1020, cliq: 164, counterBookings: 35 },
        { userId: null, name: "app", role: "app", payments: 12, collected: 260, cash: 0, cliq: 260, counterBookings: 0 },
      ],
    })
  }),

  http.get(`${BASE}/reports/platform`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const { dates, compare, period } = reportDates(url)
    const daily = dates.map((d) => {
      const m = mockDay(d, "platform")
      return { date: d, booked: m.booked * 4, fee: r3(m.booked * 4 * 0.45 * 0.05), bookings: (m.app + m.counter + m.weekly) * 4 }
    })
    const booked = daily.reduce((s, d) => s + d.booked, 0)
    const fee = daily.reduce((s, d) => s + d.fee, 0)
    return ok({
      period,
      booked: kpi(booked, compare, "pb" + period.from), fee: kpi(fee, compare, "pf" + period.from),
      collected: kpi(booked * 0.82, compare, "pc" + period.from),
      bookings: kpi(daily.reduce((s, d) => s + d.bookings, 0), compare, "pn" + period.from),
      appShare: kpi(45, compare, "pa" + period.from),
      newCompanies: kpi(2, compare, "nco"), newVenues: kpi(3, compare, "nve"),
      newPlayers: kpi(41, compare, "npl"), activeCompanies: kpi(3, compare, "aco"),
      daily,
      companies: users.filter((u) => u.role === "venue_owner").map((u, i) => ({
        ownerId: u.id, name: u.name, nameAr: null, ownerStatus: u.status,
        venues: venues.filter((v) => v.owner.id === u.id).length,
        bookings: Math.round(daily.length * 10 / (i + 1)), booked: r3(booked / 2.2 / (i + 1)),
        fee: r3(fee / 2.2 / (i + 1)), collected: r3(booked * 0.8 / 2.2 / (i + 1)),
      })),
    })
  }),

  http.get(`${BASE}/reports/export.xlsx`, async () => {
    await delay(300)
    // Not a real workbook in mock mode — only the download flow is exercised.
    return new HttpResponse(new Blob(["mock workbook"]), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    })
  }),
]

// ─── Companies (owners as companies, with limits) ────────────────────────────
// Khalid (u2) is seeded at his venue limit so the disabled "Add venue" state is visible.
const companyLimits: Record<string, { maxVenues: number | null; maxStaff: number | null }> = {
  u2: { maxVenues: 3, maxStaff: 5 },
}
const companyNames: Record<string, { name?: string; nameAr?: string | null }> = {}

function companyUsage(ownerId: string) {
  const limits = companyLimits[ownerId] ?? { maxVenues: null, maxStaff: null }
  return {
    venues: { used: venues.filter((v) => v.owner?.id === ownerId).length, max: limits.maxVenues },
    staff: {
      used: (users as MockUser[]).filter((u) => u.role === "venue_staff" && u.managedByOwnerId === ownerId && u.status === "active").length,
      max: limits.maxStaff,
    },
  }
}

function companyDto(ownerId: string) {
  const owner = users.find((u) => u.id === ownerId)
  if (!owner || owner.role !== "venue_owner") return null
  return {
    id: owner.id,
    name: companyNames[ownerId]?.name ?? owner.name,
    nameAr: companyNames[ownerId]?.nameAr ?? null,
    ownerName: owner.name,
    ownerEmail: owner.email,
    ownerStatus: owner.status,
    ...companyUsage(ownerId),
    createdAt: owner.createdAt,
    billing: billingOf(ownerId),
  }
}

function venueLimitMessage(ownerId: string) {
  const { venues: u } = companyUsage(ownerId)
  return u.max !== null && u.used >= u.max ? `This account allows ${u.max} venues. Contact PlayMaker to add more.` : null
}

function staffLimitMessage(ownerId: string) {
  const { staff: u } = companyUsage(ownerId)
  return u.max !== null && u.used >= u.max ? `This account allows ${u.max} active staff. Contact PlayMaker to add more.` : null
}

const companyHandlers = [
  http.get(`${BASE}/companies/me`, async ({ request }) => {
    await delay(200)
    const me = caller(request)
    const dto = me ? companyDto(me.id) : null
    return dto ? ok(dto) : err("Forbidden", 403)
  }),

  http.patch(`${BASE}/companies/me`, async ({ request }) => {
    await delay(300)
    const body = (await request.json()) as { name?: string; nameAr?: string; limits?: unknown }
    if (body.limits !== undefined) return err("Limits are set by PlayMaker.", 403)
    const me = caller(request)
    if (!me || me.role !== "venue_owner") return err("Forbidden", 403)
    if (body.name !== undefined && !body.name.trim()) return err("The company needs a name.", 400)
    companyNames[me.id] = { ...companyNames[me.id], ...body }
    return ok(companyDto(me.id), "Company updated")
  }),

  http.get(`${BASE}/companies`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page")) || 1
    const limit = Number(url.searchParams.get("limit")) || 20
    const search = (url.searchParams.get("search") ?? "").toLowerCase()
    const all = users
      .filter((u) => u.role === "venue_owner")
      .map((u) => companyDto(u.id)!)
      .filter((c) => !search || [c.name, c.nameAr ?? "", c.ownerName, c.ownerEmail].some((s) => s.toLowerCase().includes(search)))
    const { data, pagination } = paginate(all, page, limit)
    return HttpResponse.json({ success: true, data, message: "OK", pagination })
  }),

  http.patch(`${BASE}/companies/:ownerId`, async ({ params, request }) => {
    await delay(300)
    const ownerId = String(params.ownerId)
    if (!companyDto(ownerId)) return err("Company not found", 404)
    const body = (await request.json()) as {
      name?: string; nameAr?: string; limits?: { maxVenues: number | null; maxStaff: number | null }
    }
    if (body.limits) {
      const { maxVenues, maxStaff } = body.limits
      if ((maxVenues ?? 0) < 0 || (maxStaff ?? 0) < 0) return err("Limits cannot be negative.", 400)
      companyLimits[ownerId] = { maxVenues, maxStaff }
    }
    if (body.name !== undefined || body.nameAr !== undefined) {
      companyNames[ownerId] = {
        ...companyNames[ownerId],
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.nameAr !== undefined ? { nameAr: body.nameAr } : {}),
      }
    }
    return ok(companyDto(ownerId), "Company updated")
  }),
]

// ─── Customers ────────────────────────────────────────────────────────────────
const customers = [...mockCustomers]

/** Mirrors the server's PhoneNormalizer so lookups behave the same in mock mode. */
function normalizeJo(raw: string): string | null {
  const western = raw.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0)
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660))
  })
  let d = western.replace(/\D/g, "")
  if (d.startsWith("00962")) d = d.slice(2)
  let n = ""
  if (d.startsWith("9627") && d.length === 12) n = d.slice(3)
  else if (d.startsWith("07") && d.length === 10) n = d.slice(1)
  else if (d.startsWith("7") && d.length === 9) n = d
  if (!n) return null
  const c = `+962${n}`
  return /^\+9627[789]\d{7}$/.test(c) ? c : null
}

// ─── Venue features catalog ──────────────────────────────────────────────────
function withResolvedFeatures(body: Record<string, unknown>) {
  if (!Array.isArray(body.featureIds)) return body
  const { featureIds, ...rest } = body as { featureIds: string[] } & Record<string, unknown>
  const features = venueFeatures
    .filter(f => featureIds.includes(f.id))
    .map(({ id, name, nameAr, icon }) => ({ id, name, nameAr, icon }))
  return { ...rest, features }
}

function venueCountFor(id: string) {
  return venues.filter(v => ((v as { features?: { id: string }[] }).features ?? []).some(f => f.id === id)).length
}

const venueFeatureHandlers = [
  http.get(`${BASE}/venue-features`, async ({ request }) => {
    await delay(250)
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true"
    const list = venueFeatures
      .filter(f => includeInactive || f.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(f => ({ ...f, venueCount: venueCountFor(f.id) }))
    return ok(list)
  }),

  http.post(`${BASE}/venue-features`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as { name?: string; nameAr?: string; icon?: string; sortOrder?: number }
    const name = (body.name ?? "").trim()
    const nameAr = (body.nameAr ?? "").trim()
    if (!name || !nameAr) return err("Both the English and the Arabic name are required.", 400)
    if (venueFeatures.some(f => f.name.toLowerCase() === name.toLowerCase() || f.nameAr === nameAr))
      return err("A feature with that name already exists.", 409)
    const slug = "vf-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    const feature = {
      id: slug, name, nameAr, icon: body.icon ?? "equipment",
      sortOrder: body.sortOrder ?? Math.max(0, ...venueFeatures.map(f => f.sortOrder)) + 10,
      isActive: true,
    }
    venueFeatures = [...venueFeatures, feature]
    return ok({ ...feature, venueCount: 0 }, "Feature created")
  }),

  http.patch(`${BASE}/venue-features/:id`, async ({ params, request }) => {
    await delay(300)
    const body = await request.json() as Record<string, unknown>
    if (!venueFeatures.some(f => f.id === params.id)) return err("Feature not found", 404)
    venueFeatures = venueFeatures.map(f => f.id === params.id ? { ...f, ...body } : f)
    const updated = venueFeatures.find(f => f.id === params.id)!
    return ok({ ...updated, venueCount: venueCountFor(updated.id) }, "Feature updated")
  }),

  // Same rule as the API: a feature in use is deactivated, never deleted out from under venues.
  http.delete(`${BASE}/venue-features/:id`, async ({ params }) => {
    await delay(300)
    const inUse = venueCountFor(String(params.id))
    if (inUse > 0) return err(`Used by ${inUse} venue(s). Deactivate it instead, so those venues keep it.`, 409)
    venueFeatures = venueFeatures.filter(f => f.id !== params.id)
    return ok(null, "Feature deleted")
  }),
]

const customerHandlers = [
  // Registered BEFORE /customers/:id so "lookup" is not read as an id.
  http.get(`${BASE}/customers/lookup`, async ({ request }) => {
    await delay(220)
    const phone = new URL(request.url).searchParams.get("phone") ?? ""
    const canonical = normalizeJo(phone)
    // 200 + null, never 404 — "I don't know them" is the normal answer for a new customer.
    if (!canonical) return ok(null, "Not a Jordanian mobile")
    const found = customers.find((c) => c.phone === canonical)
    return ok(found ?? null, found ? "OK" : "New customer")
  }),

  http.get(`${BASE}/customers`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page")) || 1
    const limit = Number(url.searchParams.get("limit")) || 20
    const search = (url.searchParams.get("search") ?? "").trim().toLowerCase()
    const segment = url.searchParams.get("segment") ?? ""

    let filtered = customers.filter((c) => c.status === "active")
    if (search) {
      const canonical = normalizeJo(search)
      filtered = filtered.filter(
        (c) => c.name.toLowerCase().includes(search) || c.phone.includes(canonical ?? search),
      )
    }
    if (segment === "regulars") filtered = filtered.filter((c) => c.stats.isRegular)
    else if (segment === "lapsed") filtered = filtered.filter((c) => c.stats.isLapsed)
    else if (segment === "unreliable") filtered = filtered.filter((c) => c.stats.isUnreliable)
    else if (segment === "owing") filtered = filtered.filter((c) => c.stats.unpaid > 0)

    const { data, pagination } = paginate(filtered, page, limit)
    return HttpResponse.json({ success: true, data, message: "OK", pagination })
  }),

  http.get(`${BASE}/customers/report`, async ({ request }) => {
    await delay(320)
    const month = new URL(request.url).searchParams.get("month") ?? "2025-03"
    const active = customers.filter((c) => c.stats.daysSinceLastVisit != null && c.stats.daysSinceLastVisit < 30)
    const lapsed = customers.filter((c) => c.stats.isLapsed)
    const asItem = (c: (typeof customers)[number]) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      visits: Math.min(c.stats.attended, 4),
      noShow: c.stats.noShow,
      lastVisit: c.stats.lastVisit,
      daysSinceLastVisit: c.stats.daysSinceLastVisit,
      lifetimeVisits: c.stats.attended,
    })
    return ok({
      month,
      totalCustomers: customers.filter((c) => c.status === "active").length,
      active: active.length,
      newCustomers: customers.filter((c) => c.stats.isNew).length,
      returning: active.length - customers.filter((c) => c.stats.isNew).length,
      returnRate: active.length === 0 ? 0 : 75,
      visits: customers.reduce((s, c) => s + Math.min(c.stats.attended, 4), 0),
      noShows: customers.reduce((s, c) => s + c.stats.noShow, 0),
      lapsedCount: lapsed.length,
      topCustomers: [...active].sort((a, b) => b.stats.attended - a.stats.attended).map(asItem),
      lapsed: lapsed.map(asItem),
      trend: ["2024-10", "2024-11", "2024-12", "2025-01", "2025-02", "2025-03"].map((m, i) => ({
        month: m,
        newCustomers: [3, 2, 4, 1, 2, 1][i],
        returningCustomers: [1, 3, 5, 6, 7, 9][i],
      })),
    })
  }),

  http.get(`${BASE}/customers/:id`, async ({ params }) => {
    await delay(280)
    const c = customers.find((x) => x.id === params.id)
    if (!c) return err("Customer not found", 404)
    const recent = bookings.slice(0, 4).map((b) => ({
      id: b.id,
      venueName: b.venue.name,
      sport: b.sport,
      date: b.date.slice(0, 10),
      startTime: "18:00",
      status: b.status,
      totalAmount: b.amount,
      amountPaid: b.status === "cancelled" ? 0 : b.amount,
      isManual: true,
    }))
    return ok({ ...c, recentBookings: recent })
  }),

  http.patch(`${BASE}/customers/:id/archive`, async ({ params }) => {
    await delay(300)
    const c = customers.find((x) => x.id === params.id) as Record<string, unknown> | undefined
    if (!c) return err("Customer not found", 404)
    c.status = "archived"
    return ok(c, "Archived")
  }),

  http.patch(`${BASE}/customers/:id`, async ({ params, request }) => {
    await delay(300)
    const body = (await request.json()) as { name?: string; note?: string }
    const c = customers.find((x) => x.id === params.id) as Record<string, unknown> | undefined
    if (!c) return err("Customer not found", 404)
    if (body.name != null) c.name = body.name
    if (body.note != null) c.note = body.note || null
    return ok(c, "Saved")
  }),
]

// ─── Bookings ─────────────────────────────────────────────────────────────────
const bookingHandlers = [
  /**
   * Taking a booking at the counter — the product's headline flow, and there was no mock
   * handler for it at all. The request fell through to the real network and failed, so the
   * whole AssignBookingDialog journey was untestable in mock mode: the one place it should
   * be easiest to exercise.
   *
   * Deliberately enforces the capacity rule rather than accepting anything. A mock that
   * always says yes cannot show you that the availability filter works, and would hide the
   * exact double-booking the server exists to prevent.
   */
  http.post(`${BASE}/bookings`, async ({ request }) => {
    await delay(300)
    const b = await request.json() as Record<string, string | number | boolean | null>

    const venueId = String(b.venueId ?? "")
    const date = String(b.date ?? "")
    const startTime = String(b.startTime ?? "")
    const duration = Number(b.duration ?? 60)
    const venue = venues.find((v) => v.id === venueId) as Record<string, unknown> | undefined
    if (!venue) return err("Venue not found", 404)

    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number)
      return (h || 0) * 60 + (m || 0)
    }
    const start = toMin(startTime)
    const end = start + duration

    const clash = bookings.some((x) => {
      const row = x as unknown as {
        venue?: { id?: string }; venueId?: string; date?: string
        status?: string; startTime?: string; duration?: number
      }
      if (row.venueId !== venueId && row.venue?.id !== venueId) return false
      if (String(row.date ?? "").slice(0, 10) !== date) return false
      if (row.status === "cancelled") return false
      const s = toMin(String(row.startTime ?? "00:00"))
      return s < end && start < s + Number(row.duration ?? 60)
    })
    if (clash) return err("That slot is already taken", 409)

    const rate = Number(venue.pricePerHour ?? 0)
    const amount = Math.round(rate * (duration / 60) * 1000) / 1000
    const created = {
      id: `b-mock-${Date.now().toString(36)}`,
      venue: { id: venueId, name: String(venue.name ?? "") },
      player: { id: "u2", name: "Khalid Al-Natour" },
      customer: b.customerPhone
        ? { id: `cus_mock_${Date.now().toString(36)}`, name: String(b.customerName ?? ""), phone: String(b.customerPhone) }
        : null,
      sport: String(b.sport ?? "football"),
      date: `${date}T${startTime}:00Z`,
      startTime,
      duration,
      amount,
      totalAmount: amount,
      amountPaid: b.customerPaid ? amount : 0,
      isManual: !!b.isManual,
      status: b.isManual ? "confirmed" : "pending_payment",
      paymentMethod: String(b.paymentMethod ?? "cliq"),
      createdAt: new Date().toISOString(),
    }
    bookings.unshift(created as never)
    return ok(created, "Booking created successfully")
  }),

  http.get(`${BASE}/bookings`, async ({ request }) => {
    await delay(400)
    const url = new URL(request.url)
    const page     = Number(url.searchParams.get("page"))  || 1
    const limit    = Number(url.searchParams.get("limit")) || 20
    const status   = url.searchParams.get("status")   ?? ""
    const venue_id = url.searchParams.get("venue_id") ?? ""
    const from     = url.searchParams.get("from")     ?? ""
    const to       = url.searchParams.get("to")       ?? ""

    const owner_id = url.searchParams.get("owner_id") ?? ""

    let filtered = bookings
    if (status)   filtered = filtered.filter(b => b.status === status)
    if (venue_id) filtered = filtered.filter(b => b.venue.id === venue_id)
    // Compare date-only. b.date is a full ISO instant ("2026-07-28T18:00:00Z") while from/to
    // are "YYYY-MM-DD", so a raw string compare made every booking ON the `to` date sort
    // AFTER the bound and vanish — the timeline asks for from=to=today, so it showed an
    // empty day no matter what was booked.
    if (from)     filtered = filtered.filter(b => b.date.slice(0, 10) >= from)
    if (to)       filtered = filtered.filter(b => b.date.slice(0, 10) <= to)
    if (owner_id) {
      const ownerVenueIds = venues.filter(v => v.owner.id === owner_id).map(v => v.id)
      filtered = filtered.filter(b => ownerVenueIds.includes(b.venue.id))
    }

    // Sort by date descending
    filtered = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

    const { data, pagination } = paginate(filtered, page, limit)
    return HttpResponse.json({ success: true, data, message: "OK", pagination })
  }),

  // Attendance review — past bookings still sitting at "confirmed", i.e. nobody has said
  // whether the customer turned up.
  http.get(`${BASE}/bookings/attendance-pending`, async () => {
    await delay(250)
    const today = new Date().toISOString().slice(0, 10)
    const pending = bookings.filter(
      (b) => b.status === "confirmed" && b.date.slice(0, 10) < today,
    )
    return ok(pending.slice(0, 20))
  }),

  http.post(`${BASE}/bookings/attendance-confirm`, async ({ request }) => {
    await delay(350)
    const body = (await request.json()) as { bookingIds?: string[] }
    let confirmed = 0
    for (const id of body.bookingIds ?? []) {
      const b = bookings.find((x) => x.id === id) as Record<string, unknown> | undefined
      if (b && b.status === "confirmed") {
        b.status = "completed"
        confirmed++
      }
    }
    return ok({ confirmed }, `${confirmed} booking(s) marked as attended`)
  }),

  /**
   * Cancel / complete / mark-paid were all missing, so the three actions in the booking
   * drawer silently failed in mock mode — including the cancel-then-rebook sequence that
   * exposed cancelled bookings still being drawn on the schedule.
   */
  // Cancel applies the venue's free-cancellation window like the server; "all"/"none" overrule it.
  http.patch(`${BASE}/bookings/:id/cancel`, async ({ params, request }) => {
    await delay(250)
    const b = bookings.find((x) => (x as { id: string }).id === params.id) as Record<string, unknown> | undefined
    if (!b) return err("Booking not found", 404)
    if (b.status === "cancelled") return err("Booking is already cancelled", 400)
    const body = await request.json().catch(() => ({})) as { refund?: RefundChoice }
    const booking = b as unknown as Booking
    const venue = venues.find((v) => v.id === booking.venue.id) as { freeCancelHours?: number } | undefined
    booking.venue.freeCancelHours = venue?.freeCancelHours ?? 24
    const refund = refundFor(cancelPreview(booking, Date.now()), body.refund ?? "policy")
    b.status = "cancelled"
    if (refund > 0) moneyBack(b, refund, "refund", "Refunded on cancellation")
    return ok(b, refund > 0 ? `Booking cancelled; ${refund} JOD refunded` : "Booking cancelled successfully")
  }),

  http.post(`${BASE}/bookings/:id/refund`, async ({ params, request }) => {
    await delay(250)
    const b = bookings.find((x) => (x as { id: string }).id === params.id) as Record<string, unknown> | undefined
    if (!b) return err("Booking not found", 404)
    const body = await request.json() as { amount: number; kind: "refund" | "correction"; note?: string }
    const paid = Number(b.amountPaid ?? 0)
    if (!(body.amount > 0)) return err("Enter an amount to refund.", 400)
    if (body.amount > paid + 0.0005) return err(`Only ${paid} JOD has been paid on this booking.`, 400)
    moneyBack(b, body.amount, body.kind, body.note)
    return ok(b, body.kind === "refund" ? "Refund recorded" : "Correction recorded")
  }),

  // Move / re-price. The mock checks clashes on the same venue and day only.
  http.patch(`${BASE}/bookings/:id`, async ({ params, request }) => {
    await delay(300)
    const b = bookings.find((x) => (x as { id: string }).id === params.id) as Record<string, unknown> | undefined
    if (!b) return err("Booking not found", 404)
    const body = await request.json() as Record<string, string | number | undefined>
    const date = String(body.date ?? String(b.date).slice(0, 10))
    const startTime = String(body.startTime ?? b.startTime ?? "00:00")
    const duration = Number(body.duration ?? b.duration ?? 60)
    const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return (h || 0) * 60 + (m || 0) }
    const venueId = (b.venue as { id: string }).id
    const start = toMin(startTime)
    const clash = bookings.some((x) => {
      const row = x as unknown as { id: string; venue?: { id?: string }; date?: string; status?: string; startTime?: string; duration?: number }
      if (row.id === b.id || row.venue?.id !== venueId || row.status === "cancelled") return false
      if (String(row.date ?? "").slice(0, 10) !== date) return false
      const s = toMin(String(row.startTime ?? "00:00"))
      return s < start + duration && start < s + Number(row.duration ?? 60)
    })
    if (clash) return err("Time slot conflicts with an existing booking", 409)
    if (mockBlocks.some((k) => k.venueId === venueId && k.startsAt < `${date}T${minToHHMM(start + duration)}` && k.endsAt > `${date}T${startTime}`))
      return err("The venue is blocked at that time.", 409)
    const oldDuration = Number(b.duration ?? 60)
    b.date = `${date}T${startTime}:00Z`
    b.startTime = startTime
    b.duration = duration
    if (body.totalAmount != null) {
      b.totalAmount = b.amount = Number(body.totalAmount)
    } else if (duration !== oldDuration) {
      b.totalAmount = b.amount = Math.round(Number(b.totalAmount ?? b.amount) / oldDuration * duration * 1000) / 1000
    }
    return ok(b, "Booking updated")
  }),

  http.get(`${BASE}/bookings/:id/receipt`, async ({ params }) => {
    await delay(200)
    const b = bookings.find((x) => (x as { id: string }).id === params.id) as unknown as Booking | undefined
    if (!b) return err("Booking not found", 404)
    const rows = payments.filter((p) => (p as { bookingRef?: string }).bookingRef === b.id) as unknown as
      { date: string; amount: number; method?: string; kind?: string; note?: string }[]
    const total = b.totalAmount ?? b.amount
    return ok({
      receiptNumber: b.id.toUpperCase(),
      issuedAt: new Date().toISOString(),
      companyName: "Al-Natour Sports",
      venueName: b.venue.name,
      venueCity: b.venue.city ?? "Amman",
      customerName: b.customer?.name ?? b.player.name,
      customerPhone: b.customer?.phone ?? null,
      sport: b.sport,
      pitchName: null,
      pitchSize: b.pitchSize ?? null,
      date: b.date.slice(0, 10),
      startTime: b.startTime,
      duration: b.duration,
      status: b.status,
      totalAmount: total,
      amountPaid: b.amountPaid ?? 0,
      balance: Math.max(0, total - (b.amountPaid ?? 0)),
      payments: rows.map((p) => ({ date: p.date, amount: p.amount, method: p.method, kind: p.kind, note: p.note })),
    })
  }),

  // ─── Blocked time ───────────────────────────────────────────────────────────
  http.get(`${BASE}/venues/:id/blocks`, async ({ params }) => {
    await delay(150)
    return ok(mockBlocks.filter((k) => k.venueId === params.id))
  }),

  http.post(`${BASE}/venues/:id/blocks`, async ({ params, request }) => {
    await delay(250)
    const body = await request.json() as { pitchId?: string | null; startsAt: string; endsAt: string; reason?: string }
    if (body.endsAt <= body.startsAt) return err("The block must end after it starts", 400)
    const block = {
      id: `blk_mock_${Date.now().toString(36)}`, venueId: String(params.id), pitchId: body.pitchId ?? null,
      startsAt: body.startsAt, endsAt: body.endsAt, reason: body.reason ?? null, createdAt: new Date().toISOString(),
    }
    mockBlocks.push(block)
    const overlapping = bookings.filter((x) => {
      const row = x as unknown as { venue?: { id?: string }; date?: string; status?: string; startTime?: string; duration?: number }
      if (row.venue?.id !== params.id || row.status === "cancelled" || !row.startTime) return false
      const [h, m] = row.startTime.split(":").map(Number)
      const from = `${String(row.date).slice(0, 10)}T${row.startTime}`
      const to = `${String(row.date).slice(0, 10)}T${minToHHMM(h * 60 + m + Number(row.duration ?? 60))}`
      return from < block.endsAt && to > block.startsAt
    }).map((x) => {
      const row = x as unknown as Booking
      return { id: row.id, date: row.date.slice(0, 10), startTime: row.startTime, duration: row.duration, pitchId: row.pitchId, customerName: row.customer?.name ?? null, status: row.status }
    })
    return ok({ block, overlappingBookings: overlapping }, "Time blocked")
  }),

  http.delete(`${BASE}/venues/:id/blocks/:blockId`, async ({ params }) => {
    await delay(200)
    const i = mockBlocks.findIndex((k) => k.id === params.blockId)
    if (i < 0) return err("Block not found", 404)
    mockBlocks.splice(i, 1)
    return ok(null, "Block removed")
  }),

  http.patch(`${BASE}/bookings/:id/complete`, async ({ params }) => {
    await delay(250)
    const b = bookings.find((x) => (x as { id: string }).id === params.id) as Record<string, unknown> | undefined
    if (!b) return err("Booking not found", 404)
    if (b.status !== "confirmed") return err(`Cannot complete a booking with status '${b.status}'`, 400)
    // Completing collects, matching the server: "he played" and "he paid" are one moment.
    b.amountPaid = b.totalAmount ?? b.amount
    b.status = "completed"
    return ok(b, "Booking completed")
  }),

  http.patch(`${BASE}/bookings/:id/mark-paid`, async ({ params }) => {
    await delay(250)
    const b = bookings.find((x) => (x as { id: string }).id === params.id) as Record<string, unknown> | undefined
    if (!b) return err("Booking not found", 404)
    if (b.status === "cancelled") return err("Cannot settle a cancelled booking", 400)
    b.amountPaid = b.totalAmount ?? b.amount
    b.depositPaid = true
    return ok(b, "Marked as paid")
  }),

  http.patch(`${BASE}/bookings/:id/no-show`, async ({ params }) => {
    await delay(300)
    const b = bookings.find((x) => x.id === params.id) as Record<string, unknown> | undefined
    if (!b) return err("Booking not found", 404)
    b.status = "no_show"
    return ok(b, "Booking marked as no-show")
  }),

  // Single booking — required by ProofReviewDialog. Without it the dialog sat on a
  // permanent spinner in mock mode, so the CliQ review flow could never be exercised
  // without a live backend.
  http.get(`${BASE}/bookings/:id`, async ({ params }) => {
    await delay(250)
    const booking = bookings.find((b) => b.id === params.id)
    if (!booking) {
      return HttpResponse.json(
        { success: false, data: null, message: "Booking not found" },
        { status: 404 },
      )
    }
    return ok(booking)
  }),

  http.patch(`${BASE}/bookings/:id/review-proof`, async ({ params, request }) => {
    await delay(400)
    const body = (await request.json()) as { approved?: boolean; note?: string }
    const booking = bookings.find((b) => b.id === params.id) as Record<string, unknown> | undefined
    if (!booking) {
      return HttpResponse.json(
        { success: false, data: null, message: "Booking not found" },
        { status: 404 },
      )
    }

    if (body.approved) {
      booking.paymentProofStatus = "approved"
      booking.status = "confirmed"
      booking.depositPaid = true
      booking.amountPaid = booking.depositAmount
    } else {
      booking.paymentProofStatus = "rejected"
      booking.status = "pending_payment"
      booking.paymentProof = null
    }
    booking.paymentProofNote = body.note ?? null

    return ok(booking, body.approved ? "Proof approved" : "Proof rejected")
  }),
]

// ─── Payments ─────────────────────────────────────────────────────────────────
const paymentHandlers = [
  http.get(`${BASE}/payments`, async ({ request }) => {
    await delay(400)
    const url = new URL(request.url)
    const page  = Number(url.searchParams.get("page"))  || 1
    const limit = Number(url.searchParams.get("limit")) || 20

    const filtered = filterPayments(url)
    const { data, pagination } = paginate(filtered, page, limit)
    return HttpResponse.json({ success: true, data, message: "OK", pagination })
  }),

  http.get(`${BASE}/payments/totals`, async ({ request }) => {
    await delay(200)
    // Over the whole filtered set, never the current page — mirroring the backend, so a
    // mismatch between the strip and the table shows up here rather than in production.
    const rows = filterPayments(new URL(request.url))
    const byMethod: Record<string, number> = {}
    for (const p of rows) byMethod[p.method] = Math.round(((byMethod[p.method] ?? 0) + p.amount) * 1000) / 1000

    return HttpResponse.json({
      success: true,
      message: "OK",
      data: {
        count: rows.length,
        total: Math.round(rows.reduce((s, p) => s + p.amount, 0) * 1000) / 1000,
        byMethod,
      },
    })
  }),
]

function filterPayments(url: URL) {
  const status = url.searchParams.get("status") ?? ""
  const method = url.searchParams.get("method") ?? ""
  const from   = url.searchParams.get("from") ?? ""
  const to     = url.searchParams.get("to") ?? ""

  return payments.filter((p) => {
    if (status && p.status !== status) return false
    if (method && p.method !== method) return false
    const day = p.date.slice(0, 10)
    if (from && day < from) return false
    // Inclusive of the end day: a range ending "today" that dropped today's takings would
    // quietly under-report every time the owner looked.
    if (to && day > to) return false
    return true
  })
}

// ─── Export all ──────────────────────────────────────────────────────────────
export const handlers = [
  ...authHandlers,
  ...reportHandlers,
  ...venueHandlers,
  ...venueFeatureHandlers,
  ...userHandlers,
  ...staffHandlers,
  ...companyHandlers,
  ...businessHandlers,
  ...reportHandlers2,
  ...inboxHandlers,
  ...customerHandlers,
  ...bookingHandlers,
  ...paymentHandlers,
]
