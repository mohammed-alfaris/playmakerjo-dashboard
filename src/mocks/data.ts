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
  { id: "u6",  name: "Tariq Mansour",    email: "tariq@staff.jo",        phone: "+962791000006", role: "venue_staff", status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tariq",   createdAt: "2024-04-01T09:00:00Z" },
  { id: "u7",  name: "Dina Saleh",       email: "dina@staff.jo",         phone: "+962791000007", role: "venue_staff", status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dina",    createdAt: "2024-04-05T10:00:00Z" },
  { id: "u8",  name: "Faisal Al-Zoubi",  email: "faisal.z@player.jo",    phone: "+962791000008", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Faisal",  createdAt: "2024-05-01T07:00:00Z" },
  { id: "u9",  name: "Nour Khalil",      email: "nour.k@player.jo",      phone: "+962791000009", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nour",    createdAt: "2024-05-10T08:00:00Z" },
  { id: "u10", name: "Youssef Amawi",    email: "youssef@player.jo",     phone: "+962791000010", role: "player",      status: "banned", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Youssef", createdAt: "2024-05-15T09:00:00Z" },
  { id: "u11", name: "Sara Nimri",       email: "sara.n@player.jo",      phone: "+962791000011", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara",    createdAt: "2024-06-01T10:00:00Z" },
  { id: "u12", name: "Hassan Khatib",    email: "hassan.k@player.jo",    phone: "+962791000012", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hassan",  createdAt: "2024-06-10T11:00:00Z" },
  { id: "u13", name: "Maya Shawabkeh",   email: "maya.s@player.jo",      phone: "+962791000013", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maya",    createdAt: "2024-07-01T08:00:00Z" },
  { id: "u14", name: "Bilal Otoum",      email: "bilal.o@player.jo",     phone: "+962791000014", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bilal",   createdAt: "2024-07-15T09:00:00Z" },
  { id: "u15", name: "Rana Zreiqat",     email: "rana.z@player.jo",      phone: "+962791000015", role: "player",      status: "active", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rana",    createdAt: "2024-08-01T10:00:00Z" },
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
]

// ─── Payments ─────────────────────────────────────────────────────────────────
export const mockPayments = [
  { id: "p1",  bookingRef: "b1",  player: { id: "u8",  name: "Faisal Al-Zoubi" },  amount: 50,  method: "Credit Card", status: "paid",     date: "2025-03-01T16:05:00Z" },
  { id: "p2",  bookingRef: "b2",  player: { id: "u9",  name: "Nour Khalil" },       amount: 30,  method: "Credit Card", status: "paid",     date: "2025-03-02T10:05:00Z" },
  { id: "p3",  bookingRef: "b3",  player: { id: "u11", name: "Sara Nimri" },         amount: 18,  method: "Cliq",        status: "paid",     date: "2025-03-03T18:05:00Z" },
  { id: "p4",  bookingRef: "b4",  player: { id: "u12", name: "Hassan Khatib" },      amount: 50,  method: "Credit Card", status: "refunded", date: "2025-03-05T17:05:00Z" },
  { id: "p5",  bookingRef: "b5",  player: { id: "u13", name: "Maya Shawabkeh" },     amount: 44,  method: "Cliq",        status: "paid",     date: "2025-03-07T09:05:00Z" },
  { id: "p6",  bookingRef: "b6",  player: { id: "u14", name: "Bilal Otoum" },        amount: 140, method: "Bank Transfer",status: "paid",     date: "2025-03-10T08:05:00Z" },
  { id: "p7",  bookingRef: "b7",  player: { id: "u15", name: "Rana Zreiqat" },       amount: 40,  method: "Credit Card", status: "pending",  date: "2025-03-11T07:05:00Z" },
  { id: "p8",  bookingRef: "b8",  player: { id: "u8",  name: "Faisal Al-Zoubi" },    amount: 60,  method: "Cliq",        status: "paid",     date: "2025-03-12T15:05:00Z" },
  { id: "p9",  bookingRef: "b9",  player: { id: "u9",  name: "Nour Khalil" },         amount: 18,  method: "Credit Card", status: "pending",  date: "2025-03-14T19:05:00Z" },
  { id: "p10", bookingRef: "b10", player: { id: "u11", name: "Sara Nimri" },          amount: 50,  method: "Bank Transfer",status: "paid",     date: "2025-03-15T16:05:00Z" },
  { id: "p11", bookingRef: "b11", player: { id: "u12", name: "Hassan Khatib" },       amount: 22,  method: "Cliq",        status: "pending",  date: "2025-03-16T10:05:00Z" },
  { id: "p12", bookingRef: "b12", player: { id: "u13", name: "Maya Shawabkeh" },      amount: 105, method: "Credit Card", status: "paid",     date: "2025-03-18T08:05:00Z" },
  { id: "p13", bookingRef: "b13", player: { id: "u14", name: "Bilal Otoum" },         amount: 80,  method: "Bank Transfer",status: "paid",     date: "2025-03-20T06:05:00Z" },
  { id: "p14", bookingRef: "b14", player: { id: "u15", name: "Rana Zreiqat" },        amount: 30,  method: "Credit Card", status: "refunded", date: "2025-03-21T17:05:00Z" },
  { id: "p15", bookingRef: "b15", player: { id: "u8",  name: "Faisal Al-Zoubi" },     amount: 50,  method: "Cliq",        status: "pending",  date: "2025-03-22T18:05:00Z" },
  { id: "p16", bookingRef: "b16", player: { id: "u9",  name: "Nour Khalil" },          amount: 18,  method: "Credit Card", status: "paid",     date: "2025-03-23T20:05:00Z" },
  { id: "p17", bookingRef: "b17", player: { id: "u11", name: "Sara Nimri" },           amount: 44,  method: "Cliq",        status: "paid",     date: "2025-03-24T09:05:00Z" },
  { id: "p18", bookingRef: "b18", player: { id: "u12", name: "Hassan Khatib" },        amount: 140, method: "Bank Transfer",status: "paid",     date: "2025-03-25T08:05:00Z" },
  { id: "p19", bookingRef: "b19", player: { id: "u13", name: "Maya Shawabkeh" },       amount: 40,  method: "Credit Card", status: "failed",   date: "2025-03-26T07:05:00Z" },
  { id: "p20", bookingRef: "b20", player: { id: "u14", name: "Bilal Otoum" },          amount: 60,  method: "Cliq",        status: "paid",     date: "2025-03-27T14:05:00Z" },
]

// ─── Reports ─────────────────────────────────────────────────────────────────
export const mockSummary = {
  totalRevenue: 1289,
  totalBookings: 25,
  totalVenues: 8,
  totalUsers: 15,
  revenueChange: 12.4,
  bookingsChange: 8.1,
  venuesChange: 14.3,
  usersChange: 5.0,
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
