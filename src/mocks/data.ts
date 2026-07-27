// ─── Auth ────────────────────────────────────────────────────────────────────
export const mockAdmin = {
  id: "u1",
  name: "Ahmad Al-Hassan",
  email: "admin@sportsvenue.jo",
  role: "super_admin",
}

// ─── Users ───────────────────────────────────────────────────────────────────
export const mockUsers = [
  { id: "u1",  name: "Ahmad Al-Hassan",  email: "admin@sportsvenue.jo",  phone: "+962791000001", role: "super_admin", status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmad",   createdAt: "2024-01-01T08:00:00Z" },
  { id: "u2",  name: "Khalid Al-Natour", email: "khalid@venues.jo",      phone: "+962791000002", role: "venue_owner", status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Khalid",  createdAt: "2024-02-10T09:00:00Z" },
  { id: "u3",  name: "Rania Haddad",     email: "rania@venues.jo",       phone: "+962791000003", role: "venue_owner", status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rania",   createdAt: "2024-02-15T10:00:00Z" },
  { id: "u4",  name: "Omar Farouq",      email: "omar.f@venues.jo",      phone: "+962791000004", role: "venue_owner", status: "banned", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Omar",    createdAt: "2024-03-01T11:00:00Z" },
  { id: "u5",  name: "Lina Barakat",     email: "lina.b@venues.jo",      phone: "+962791000005", role: "venue_owner", status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lina",    createdAt: "2024-03-20T08:30:00Z" },
  // Staff belong to an owner (u2 Khalid) and carry a read/write level — that link is what
  // decides which venues they can touch.
  { id: "u6",  name: "Tariq Mansour",    email: "tariq@staff.jo",        phone: "+962791000006", role: "venue_staff", status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tariq",   createdAt: "2024-04-01T09:00:00Z", permissions: "write", managedByOwnerId: "u2" },
  { id: "u7",  name: "Dina Saleh",       email: "dina@staff.jo",         phone: "+962791000007", role: "venue_staff", status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dina",    createdAt: "2024-04-05T10:00:00Z", permissions: "read",  managedByOwnerId: "u2" },
  { id: "u8",  name: "Faisal Al-Zoubi",  email: "faisal.z@player.jo",    phone: "+962791000008", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Faisal",  createdAt: "2024-05-01T07:00:00Z" },
  { id: "u9",  name: "Nour Khalil",      email: "nour.k@player.jo",      phone: "+962791000009", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nour",    createdAt: "2024-05-10T08:00:00Z" },
  { id: "u10", name: "Youssef Amawi",    email: "youssef@player.jo",     phone: "+962791000010", role: "player",      status: "banned", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Youssef", createdAt: "2024-05-15T09:00:00Z" },
  { id: "u11", name: "Sara Nimri",       email: "sara.n@player.jo",      phone: "+962791000011", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara",    createdAt: "2024-06-01T10:00:00Z" },
  { id: "u12", name: "Hassan Khatib",    email: "hassan.k@player.jo",    phone: "+962791000012", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hassan",  createdAt: "2024-06-10T11:00:00Z" },
  { id: "u13", name: "Maya Shawabkeh",   email: "maya.s@player.jo",      phone: "+962791000013", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maya",    createdAt: "2024-07-01T08:00:00Z" },
  { id: "u14", name: "Bilal Otoum",      email: "bilal.o@player.jo",     phone: "+962791000014", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bilal",   createdAt: "2024-07-15T09:00:00Z" },
  { id: "u15", name: "Rana Zreiqat",     email: "rana.z@player.jo",      phone: "+962791000015", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rana",    createdAt: "2024-08-01T10:00:00Z" },

  // Padding past DEFAULT_PAGE_SIZE (20) so the list actually paginates in mock mode.
  // Without a second page the usePagination "cannot leave page 1" bug is invisible.
  { id: "u16", name: "Ahmad Qasem",      email: "ahmad.q@player.jo",     phone: "+962791000016", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=AhmadQ",  createdAt: "2024-08-05T10:00:00Z" },
  { id: "u17", name: "Layla Haddadin",   email: "layla.h@player.jo",     phone: "+962791000017", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Layla",   createdAt: "2024-08-10T10:00:00Z" },
  { id: "u18", name: "Zaid Tarawneh",    email: "zaid.t@player.jo",      phone: "+962791000018", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zaid",    createdAt: "2024-08-15T10:00:00Z" },
  { id: "u19", name: "Huda Masri",       email: "huda.m@player.jo",      phone: "+962791000019", role: "player",      status: "banned", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Huda",    createdAt: "2024-08-20T10:00:00Z" },
  { id: "u20", name: "Kareem Dabbas",    email: "kareem.d@player.jo",    phone: "+962791000020", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kareem",  createdAt: "2024-08-25T10:00:00Z" },
  { id: "u21", name: "Aya Sukkar",       email: "aya.s@player.jo",       phone: "+962791000021", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aya",     createdAt: "2024-09-01T10:00:00Z" },
  { id: "u22", name: "Rami Halaby",      email: "rami.h@player.jo",      phone: "+962791000022", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rami",    createdAt: "2024-09-05T10:00:00Z" },
  { id: "u23", name: "Salma Rifai",      email: "salma.r@player.jo",     phone: "+962791000023", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Salma",   createdAt: "2024-09-10T10:00:00Z" },
  { id: "u24", name: "Marwan Btoush",    email: "marwan.b@player.jo",    phone: "+962791000024", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marwan",  createdAt: "2024-09-15T10:00:00Z" },
  { id: "u25", name: "Dana Qudah",       email: "dana.q@player.jo",      phone: "+962791000025", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dana",    createdAt: "2024-09-20T10:00:00Z" },
]

// ─── Venues ──────────────────────────────────────────────────────────────────
export const mockVenues = [
  {
    id: "v1", name: "Al-Ameen Football Arena",
    owner: { id: "u2", name: "Khalid Al-Natour" },
    sports: ["football"], city: "Amman", address: "Al-Rabweh, Amman",
    pricePerHour: 25, status: "active",
    description: "Full-size football pitch with floodlights.",
    images: ["https://picsum.photos/seed/v1a/800/400", "https://picsum.photos/seed/v1b/800/400"],
    latitude: 31.9819, longitude: 35.8718,
    createdAt: "2024-02-12T08:00:00Z",
  },
  {
    id: "v2", name: "Capital Sports Hub",
    owner: { id: "u3", name: "Rania Haddad" },
    sports: ["basketball", "volleyball"], city: "Amman", address: "Sweifieh, Amman",
    pricePerHour: 30, status: "active",
    description: "Indoor multi-sport center.",
    images: ["https://picsum.photos/seed/v2a/800/400", "https://picsum.photos/seed/v2b/800/400"],
    latitude: 31.9560, longitude: 35.8670,
    createdAt: "2024-02-20T09:00:00Z",
  },
  {
    id: "v3", name: "Zarqa Tennis Club",
    owner: { id: "u4", name: "Omar Farouq" },
    sports: ["tennis", "padel"], city: "Zarqa", address: "New Zarqa, Zarqa",
    pricePerHour: 20, status: "inactive",
    description: "Clay courts, 4 outdoor tennis courts.",
    images: ["https://picsum.photos/seed/v3a/800/400"],
    latitude: 32.0637, longitude: 36.1036,
    createdAt: "2024-03-05T10:00:00Z",
  },
  {
    id: "v4", name: "Northern Star Padel",
    owner: { id: "u5", name: "Lina Barakat" },
    sports: ["padel"], city: "Irbid", address: "University Street, Irbid",
    pricePerHour: 18, status: "active",
    description: "3 padel courts, air conditioned.",
    images: ["https://picsum.photos/seed/v4a/800/400", "https://picsum.photos/seed/v4b/800/400"],
    latitude: 32.5568, longitude: 35.8469,
    createdAt: "2024-03-25T11:00:00Z",
  },
  {
    id: "v5", name: "Aqaba Beach Sports",
    owner: { id: "u2", name: "Khalid Al-Natour" },
    sports: ["volleyball", "football"], city: "Aqaba", address: "South Beach, Aqaba",
    pricePerHour: 22, status: "active",
    description: "Beach volleyball and football on the Red Sea shore.",
    images: ["https://picsum.photos/seed/v5a/800/400", "https://picsum.photos/seed/v5b/800/400", "https://picsum.photos/seed/v5c/800/400"],
    latitude: 29.5269, longitude: 35.0082,
    createdAt: "2024-04-10T08:30:00Z",
  },
  {
    id: "v6", name: "Petra Squash Center",
    owner: { id: "u3", name: "Rania Haddad" },
    sports: ["squash"], city: "Ma'an", address: "City Center, Ma'an",
    pricePerHour: 15, status: "pending",
    description: "3 professional squash courts.",
    images: ["https://picsum.photos/seed/v6a/800/400"],
    latitude: 30.1983, longitude: 35.7341,
    createdAt: "2024-04-20T09:00:00Z",
  },
  {
    id: "v7", name: "Al-Salt Cricket Ground",
    owner: { id: "u5", name: "Lina Barakat" },
    sports: ["cricket"], city: "Al-Salt", address: "Al-Salt Hills",
    pricePerHour: 35, status: "active",
    description: "Full cricket ground with pavilion.",
    images: ["https://picsum.photos/seed/v7a/800/400", "https://picsum.photos/seed/v7b/800/400"],
    latitude: 32.0330, longitude: 35.7272,
    createdAt: "2024-05-01T10:00:00Z",
  },
  {
    id: "v8", name: "Madaba Aqua Sports",
    owner: { id: "u2", name: "Khalid Al-Natour" },
    sports: ["swimming"], city: "Madaba", address: "King's Highway, Madaba",
    pricePerHour: 40, status: "active",
    description: "Olympic-size indoor swimming pool.",
    images: ["https://picsum.photos/seed/v8a/800/400", "https://picsum.photos/seed/v8b/800/400"],
    latitude: 31.7164, longitude: 35.7934,
    createdAt: "2024-05-15T11:00:00Z",
  },
]

// ─── Bookings ─────────────────────────────────────────────────────────────────
export const mockBookings = [
  { id: "b1",  venue: { id: "v1", name: "Al-Ameen Football Arena" }, player: { id: "u8",  name: "Faisal Al-Zoubi" },  sport: "football",   date: "2025-03-01T16:00:00Z", duration: 2, amount: 50,  status: "completed" },
  { id: "b2",  venue: { id: "v2", name: "Capital Sports Hub" },      player: { id: "u9",  name: "Nour Khalil" },       sport: "basketball", date: "2025-03-02T10:00:00Z", duration: 1, amount: 30,  status: "completed" },
  { id: "b3",  venue: { id: "v4", name: "Northern Star Padel" },     player: { id: "u11", name: "Sara Nimri" },         sport: "padel",      date: "2025-03-03T18:00:00Z", duration: 1, amount: 18,  status: "completed" },
  { id: "b4",  venue: { id: "v1", name: "Al-Ameen Football Arena" }, player: { id: "u12", name: "Hassan Khatib" },      sport: "football",   date: "2025-03-05T17:00:00Z", duration: 2, amount: 50,  status: "cancelled" },
  { id: "b5",  venue: { id: "v5", name: "Aqaba Beach Sports" },      player: { id: "u13", name: "Maya Shawabkeh" },     sport: "volleyball", date: "2025-03-07T09:00:00Z", duration: 2, amount: 44,  status: "completed" },
  { id: "b6",  venue: { id: "v7", name: "Al-Salt Cricket Ground" },  player: { id: "u14", name: "Bilal Otoum" },        sport: "cricket",    date: "2025-03-10T08:00:00Z", duration: 4, amount: 140, status: "completed" },
  { id: "b7",  venue: { id: "v8", name: "Madaba Aqua Sports" },      player: { id: "u15", name: "Rana Zreiqat" },       sport: "swimming",   date: "2025-03-11T07:00:00Z", duration: 1, amount: 40,  status: "confirmed" },
  { id: "b8",  venue: { id: "v2", name: "Capital Sports Hub" },      player: { id: "u8",  name: "Faisal Al-Zoubi" },    sport: "volleyball", date: "2025-03-12T15:00:00Z", duration: 2, amount: 60,  status: "confirmed" },
  { id: "b9",  venue: { id: "v4", name: "Northern Star Padel" },     player: { id: "u9",  name: "Nour Khalil" },         sport: "padel",      date: "2025-03-14T19:00:00Z", duration: 1, amount: 18,  status: "pending"   },
  { id: "b10", venue: { id: "v1", name: "Al-Ameen Football Arena" }, player: { id: "u11", name: "Sara Nimri" },          sport: "football",   date: "2025-03-15T16:00:00Z", duration: 2, amount: 50,  status: "confirmed" },
  { id: "b11", venue: { id: "v5", name: "Aqaba Beach Sports" },      player: { id: "u12", name: "Hassan Khatib" },       sport: "football",   date: "2025-03-16T10:00:00Z", duration: 1, amount: 22,  status: "pending"   },
  { id: "b12", venue: { id: "v7", name: "Al-Salt Cricket Ground" },  player: { id: "u13", name: "Maya Shawabkeh" },      sport: "cricket",    date: "2025-03-18T08:00:00Z", duration: 3, amount: 105, status: "confirmed" },
  { id: "b13", venue: { id: "v8", name: "Madaba Aqua Sports" },      player: { id: "u14", name: "Bilal Otoum" },         sport: "swimming",   date: "2025-03-20T06:00:00Z", duration: 2, amount: 80,  status: "completed" },
  { id: "b14", venue: { id: "v2", name: "Capital Sports Hub" },      player: { id: "u15", name: "Rana Zreiqat" },        sport: "basketball", date: "2025-03-21T17:00:00Z", duration: 1, amount: 30,  status: "cancelled" },
  { id: "b15", venue: { id: "v1", name: "Al-Ameen Football Arena" }, player: { id: "u8",  name: "Faisal Al-Zoubi" },     sport: "football",   date: "2025-03-22T18:00:00Z", duration: 2, amount: 50,  status: "pending"   },
  { id: "b16", venue: { id: "v4", name: "Northern Star Padel" },     player: { id: "u9",  name: "Nour Khalil" },          sport: "padel",      date: "2025-03-23T20:00:00Z", duration: 1, amount: 18,  status: "confirmed" },
  { id: "b17", venue: { id: "v5", name: "Aqaba Beach Sports" },      player: { id: "u11", name: "Sara Nimri" },           sport: "volleyball", date: "2025-03-24T09:00:00Z", duration: 2, amount: 44,  status: "completed" },
  { id: "b18", venue: { id: "v7", name: "Al-Salt Cricket Ground" },  player: { id: "u12", name: "Hassan Khatib" },        sport: "cricket",    date: "2025-03-25T08:00:00Z", duration: 4, amount: 140, status: "confirmed" },
  { id: "b19", venue: { id: "v8", name: "Madaba Aqua Sports" },      player: { id: "u13", name: "Maya Shawabkeh" },       sport: "swimming",   date: "2025-03-26T07:00:00Z", duration: 1, amount: 40,  status: "pending"   },
  { id: "b20", venue: { id: "v2", name: "Capital Sports Hub" },      player: { id: "u14", name: "Bilal Otoum" },          sport: "basketball", date: "2025-03-27T14:00:00Z", duration: 2, amount: 60,  status: "completed" },
  { id: "b21", venue: { id: "v1", name: "Al-Ameen Football Arena" }, player: { id: "u15", name: "Rana Zreiqat" },         sport: "football",   date: "2025-03-28T16:00:00Z", duration: 1, amount: 25,  status: "confirmed" },
  { id: "b22", venue: { id: "v4", name: "Northern Star Padel" },     player: { id: "u8",  name: "Faisal Al-Zoubi" },      sport: "padel",      date: "2025-03-29T19:00:00Z", duration: 2, amount: 36,  status: "completed" },
  { id: "b23", venue: { id: "v5", name: "Aqaba Beach Sports" },      player: { id: "u9",  name: "Nour Khalil" },           sport: "football",   date: "2025-03-30T10:00:00Z", duration: 1, amount: 22,  status: "pending"   },
  { id: "b24", venue: { id: "v7", name: "Al-Salt Cricket Ground" },  player: { id: "u11", name: "Sara Nimri" },            sport: "cricket",    date: "2025-03-30T08:00:00Z", duration: 3, amount: 105, status: "confirmed" },
  { id: "b25", venue: { id: "v8", name: "Madaba Aqua Sports" },      player: { id: "u12", name: "Hassan Khatib" },         sport: "swimming",   date: "2025-03-31T06:00:00Z", duration: 1, amount: 40,  status: "pending"   },

  // Two CliQ proof-review cases, so the review dialog can actually be exercised in
  // mock mode. b90 has an uploaded screenshot; b91 has NONE — that second case is the
  // one that used to render a fabricated "CliQ TRANSFER RECEIPT" complete with a green
  // tick and a bank name, and must now show an explicit empty state instead.
  {
    id: "b90", venue: { id: "v1", name: "Al-Ameen Football Arena", cliqAlias: "ALAMEEN.ARENA" },
    player: { id: "u8", name: "Faisal Al-Zoubi" }, sport: "football",
    date: "2025-04-02T18:00:00Z", duration: 2, amount: 50, status: "pending_payment",
    paymentMethod: "cliq", depositAmount: 10, amountPaid: 0,
    paymentProof: "https://picsum.photos/seed/cliqproof/700/900",
    paymentProofStatus: "pending_review",
  },
  {
    id: "b91", venue: { id: "v2", name: "Capital Sports Hub", cliqAlias: "CAPITAL.HUB" },
    player: { id: "u9", name: "Nour Khalil" }, sport: "basketball",
    date: "2025-04-03T20:00:00Z", duration: 1, amount: 30, status: "pending_payment",
    paymentMethod: "cliq", depositAmount: 6, amountPaid: 0,
    paymentProof: null,
    paymentProofStatus: "pending_review",
  },
]

// Mark roughly a third of the seeded bookings as taken at the counter, each linked to a
// customer record. Without this every mock booking looks like an app booking and the two
// channels are indistinguishable on screen — which is the exact thing the new column
// exists to show.
const COUNTER_CUSTOMERS = [
  { id: "cus_regular01", name: "خالد النتور", phone: "+962791110001" },
  { id: "cus_lapsed01", name: "سامي عبد الله", phone: "+962791110002" },
  { id: "cus_noshow01", name: "ليث الحديد", phone: "+962791110003" },
  { id: "cus_owing01", name: "رنا زريقات", phone: "+962791110004" },
]

mockBookings.forEach((b, i) => {
  if (i % 3 !== 0) return
  const record = b as Record<string, unknown>
  record.isManual = true
  record.customer = COUNTER_CUSTOMERS[(i / 3) % COUNTER_CUSTOMERS.length]
  // One of them is a phone booking that hasn't been paid for yet.
  if (i % 9 === 0) record.amountPaid = 0
})

// One cancelled booking was released by the expiry job rather than by a person. Both carry
// status "cancelled" — there is no "expired" status, because "cancelled" is the only literal
// the backend's conflict scans treat as freeing a slot — so autoCancelledAt is the only thing
// separating them, and without a row carrying it the distinction is invisible in development.
//
// Runs AFTER the counter-booking pass and skips manual rows deliberately: a counter booking
// is never armed with a deadline, so one that had been auto-cancelled could not exist. Demo
// data that contradicts the rules it is demonstrating is worse than none.
// Placed at the SAME venue as an existing human-cancelled booking, so an owner sees both
// side by side on one screen. Owner scoping means a released booking at a venue he does not
// own is invisible to him — correct behaviour, but useless for showing the difference.
const humanCancelled = mockBookings.find((b) => b.status === "cancelled")
const autoReleased = mockBookings.find(
  (b) =>
    b.venue.id === humanCancelled?.venue.id &&
    b.id !== humanCancelled?.id &&
    !(b as Record<string, unknown>).isManual,
)
if (autoReleased) {
  const record = autoReleased as Record<string, unknown>
  record.status = "cancelled"
  record.autoCancelledAt = "2025-03-21T18:00:00Z"
}

// ─── Customers ────────────────────────────────────────────────────────────────
// Deliberately covers every state the screen has to render: a healthy regular, one who
// stopped coming, one who keeps not turning up, one who owes money, and a brand-new name.
function stats(o: Partial<ReturnType<typeof emptyStats>> = {}) {
  return { ...emptyStats(), ...o }
}
function emptyStats() {
  return {
    totalBookings: 0, attended: 0, upcoming: 0, noShow: 0, cancelled: 0,
    unpaid: 0, amountOwed: 0, viaCounter: 0, viaApp: 0,
    lastVisit: null as string | null, customerSince: null as string | null,
    daysSinceLastVisit: null as number | null, noShowRate: 0,
    isRegular: false, isLapsed: false, isNew: false, isUnreliable: false,
  }
}

export const mockCustomers = [
  {
    id: "cus_regular01", name: "خالد النتور", phone: "+962791110001",
    note: "بيلعب كل ثلاثاء", status: "active" as const, createdAt: "2025-01-10T09:00:00Z",
    stats: stats({
      totalBookings: 18, attended: 17, upcoming: 1, viaCounter: 14, viaApp: 4,
      lastVisit: "2025-03-24", customerSince: "2025-01-10", daysSinceLastVisit: 4,
      isRegular: true,
    }),
  },
  {
    id: "cus_lapsed01", name: "سامي عبد الله", phone: "+962791110002",
    note: null, status: "active" as const, createdAt: "2024-11-02T09:00:00Z",
    stats: stats({
      totalBookings: 9, attended: 9, viaCounter: 9,
      lastVisit: "2025-01-20", customerSince: "2024-11-02", daysSinceLastVisit: 67,
      isLapsed: true,
    }),
  },
  {
    id: "cus_noshow01", name: "ليث الحديد", phone: "+962791110003",
    note: null, status: "active" as const, createdAt: "2025-02-01T09:00:00Z",
    stats: stats({
      totalBookings: 7, attended: 4, noShow: 3, viaCounter: 7,
      lastVisit: "2025-03-15", customerSince: "2025-02-01", daysSinceLastVisit: 13,
      noShowRate: 42.9, isUnreliable: true,
    }),
  },
  {
    id: "cus_owing01", name: "رنا زريقات", phone: "+962791110004",
    note: "بتدفع عند الوصول", status: "active" as const, createdAt: "2025-02-20T09:00:00Z",
    stats: stats({
      totalBookings: 5, attended: 4, upcoming: 1, unpaid: 2, amountOwed: 45,
      viaCounter: 5, lastVisit: "2025-03-22", customerSince: "2025-02-20",
      daysSinceLastVisit: 6,
    }),
  },
  {
    id: "cus_new01", name: "أحمد قاسم", phone: "+962791110005",
    note: null, status: "active" as const, createdAt: "2025-03-25T09:00:00Z",
    stats: stats({
      totalBookings: 1, attended: 1, viaCounter: 1,
      lastVisit: "2025-03-25", customerSince: "2025-03-25", daysSinceLastVisit: 3,
      isNew: true,
    }),
  },
]

// ─── Payments ─────────────────────────────────────────────────────────────────
/**
 * Derived from mockBookings rather than hand-listed.
 *
 * The list this replaces recorded 50 JOD against b1 while b1 itself said nothing had been
 * paid, and carried "pending" and "failed" rows — neither of which an append-only record of
 * money RECEIVED can contain. Money not yet arrived is the ABSENCE of a row, which is what
 * the untouched pending_payment bookings now correctly show.
 *
 * Two rows on one booking is the case worth having in demo data, because it is the one a
 * single amountPaid number cannot express: 20% by CliQ up front, the rest in cash on the day.
 */
type PayableBooking = {
  id: string
  venue: { id: string; name: string }
  player: { id: string; name: string }
  customer?: { id: string; name: string }
  date: string
  amount: number
  status: string
}

const RECORDERS = [
  { id: "u2", name: "Yousef Barakat" },
  { id: "u5", name: "Omar Haddad" },
]

export const mockPayments = (mockBookings as unknown as PayableBooking[])
  .filter((b) => ["completed", "confirmed", "cancelled"].includes(b.status))
  .flatMap((b, i) => {
    const deposit = Math.round(b.amount * 0.2 * 1000) / 1000
    const shared = {
      bookingRef: b.id,
      player: b.player,
      customer: b.customer,
      // The customer whenever one is known — never the owner's own account, which is what
      // player holds on a counter booking.
      payerName: b.customer?.name ?? b.player.name,
      recordedBy: RECORDERS[i % RECORDERS.length],
      venue: b.venue,
      status: "paid",
    }

    const rows = [{
      ...shared,
      id: `pay-${b.id}-d`,
      amount: deposit,
      method: "cliq",
      kind: "deposit",
      note: "CliQ proof approved",
      date: b.date,
    }]

    if (b.status === "completed") {
      rows.push({
        ...shared,
        id: `pay-${b.id}-b`,
        amount: Math.round((b.amount - deposit) * 1000) / 1000,
        method: "cash",
        kind: "balance",
        note: "Settled at the venue",
        date: new Date(new Date(b.date).getTime() + 3_600_000).toISOString(),
      })
    }

    return rows
  })

// ─── Reports ─────────────────────────────────────────────────────────────────
export const mockSummary = {
  totalRevenue: 1289,
  totalBookings: 25,
  totalVenues: 8,
  totalUsers: 15,
  // Null, matching the API. These were hardcoded percentages rendered as if real.
  revenueChange: null,
  bookingsChange: null,
  venuesChange: null,
  usersChange: null,
}

export const mockRevenueChart = Array.from({ length: 30 }, (_, i) => {
  const d = new Date("2025-03-01")
  d.setDate(d.getDate() + i)
  return {
    date: d.toISOString().split("T")[0],
    revenue: Math.floor(30 + Math.random() * 120),
  }
})

export const mockTopVenues = [
  { id: "v1", name: "Al-Ameen Football Arena", revenue: 325 },
  { id: "v7", name: "Al-Salt Cricket Ground",  revenue: 280 },
  { id: "v8", name: "Madaba Aqua Sports",      revenue: 240 },
  { id: "v2", name: "Capital Sports Hub",      revenue: 210 },
  { id: "v5", name: "Aqaba Beach Sports",      revenue: 132 },
]

export const mockSportsBreakdown = [
  { sport: "Football",   count: 8 },
  { sport: "Cricket",    count: 5 },
  { sport: "Swimming",   count: 4 },
  { sport: "Basketball", count: 3 },
  { sport: "Padel",      count: 3 },
  { sport: "Volleyball", count: 2 },
]
