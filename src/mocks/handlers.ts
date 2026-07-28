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
} from "./data"

const BASE = import.meta.env.VITE_API_URL as string

// Mutable copies so POST/PATCH/DELETE mutations persist during the session
let users = [...mockUsers]
let venues = [...mockVenues]
const bookings = [...mockBookings]
const payments = [...mockPayments]

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

    return ok(
      { user, accessToken: `mock-access-token-${user.role}` },
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
    const body = await request.json() as Record<string, unknown>
    const newVenue = { id: `v${Date.now()}`, status: "active", createdAt: new Date().toISOString(), ...body }
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
    const body = await request.json() as Record<string, unknown>
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

  http.patch(`${BASE}/users/:id/status`, async ({ params, request }) => {
    await delay(400)
    const body = await request.json() as { status: string }
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
// mock has no token, so it stands in the owner whose team is seeded (u2 Khalid).
const MOCK_OWNER_ID = "u2"

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
  http.patch(`${BASE}/bookings/:id/cancel`, async ({ params }) => {
    await delay(250)
    const b = bookings.find((x) => (x as { id: string }).id === params.id) as Record<string, unknown> | undefined
    if (!b) return err("Booking not found", 404)
    if (b.status === "cancelled") return err("Booking is already cancelled", 400)
    b.status = "cancelled"
    return ok(b, "Booking cancelled successfully")
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
  ...userHandlers,
  ...staffHandlers,
  ...customerHandlers,
  ...bookingHandlers,
  ...paymentHandlers,
]
