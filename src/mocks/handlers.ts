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

  http.get(`${BASE}/reports/top-venues`, async () => {
    await delay(300)
    return ok(mockTopVenues)
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

// ─── Bookings ─────────────────────────────────────────────────────────────────
const bookingHandlers = [
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
    if (from)     filtered = filtered.filter(b => b.date >= from)
    if (to)       filtered = filtered.filter(b => b.date <= to)
    if (owner_id) {
      const ownerVenueIds = venues.filter(v => v.owner.id === owner_id).map(v => v.id)
      filtered = filtered.filter(b => ownerVenueIds.includes(b.venue.id))
    }

    // Sort by date descending
    filtered = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

    const { data, pagination } = paginate(filtered, page, limit)
    return HttpResponse.json({ success: true, data, message: "OK", pagination })
  }),
]

// ─── Payments ─────────────────────────────────────────────────────────────────
const paymentHandlers = [
  http.get(`${BASE}/payments`, async ({ request }) => {
    await delay(400)
    const url = new URL(request.url)
    const page   = Number(url.searchParams.get("page"))  || 1
    const limit  = Number(url.searchParams.get("limit")) || 20
    const status = url.searchParams.get("status") ?? ""

    let filtered = payments
    if (status) filtered = filtered.filter(p => p.status === status)

    const { data, pagination } = paginate(filtered, page, limit)
    return HttpResponse.json({ success: true, data, message: "OK", pagination })
  }),
]

// ─── Export all ──────────────────────────────────────────────────────────────
export const handlers = [
  ...authHandlers,
  ...reportHandlers,
  ...venueHandlers,
  ...userHandlers,
  ...bookingHandlers,
  ...paymentHandlers,
]
