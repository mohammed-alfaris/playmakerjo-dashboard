import { describe, expect, it } from "vitest"
import { ago, freshArrivals, localized, targetOf } from "../inbox"
import type { InboxItem } from "@/api/notifications"

const item = (over: Partial<InboxItem>): InboxItem => ({
  id: "n1", title: "New booking|حجز جديد", body: "b", type: "new_booking", referenceId: "bk1",
  isRead: false, createdAt: "2026-09-30T10:00:00Z", ...over,
})

describe("localized", () => {
  it("picks the reader's half of the server's bilingual text", () => {
    expect(localized("New booking|حجز جديد", "en")).toBe("New booking")
    expect(localized("New booking|حجز جديد", "ar")).toBe("حجز جديد")
    expect(localized("Plain text", "ar")).toBe("Plain text")
  })
})

describe("targetOf", () => {
  it("sends a new PlayMaker invoice to the billing page", () => {
    expect(targetOf(item({ type: "invoice_issued", referenceId: "inv_1" }))).toEqual({ kind: "route", path: "/billing" })
  })
  it("opens the booking, the proof, or the leads page", () => {
    expect(targetOf({ type: "new_booking", referenceId: "bk1" })).toEqual({ kind: "booking", bookingId: "bk1" })
    expect(targetOf({ type: "booking_cancelled", referenceId: "bk2" })).toEqual({ kind: "booking", bookingId: "bk2" })
    expect(targetOf({ type: "proof_received", referenceId: "bk3" })).toEqual({ kind: "proof", bookingId: "bk3" })
    expect(targetOf({ type: "venue_lead", referenceId: "7" })).toEqual({ kind: "route", path: "/leads" })
    expect(targetOf({ type: "general", referenceId: null })).toEqual({ kind: "none" })
  })
  it("opens the proof for a waiting nudge, the bookings for a cancelled series, the venue for a review", () => {
    expect(targetOf({ type: "proof_waiting", referenceId: "bk4" })).toEqual({ kind: "proof", bookingId: "bk4" })
    expect(targetOf({ type: "series_cancelled", referenceId: "rg_1" })).toEqual({ kind: "route", path: "/bookings" })
    expect(targetOf({ type: "new_review", referenceId: "v1" })).toEqual({ kind: "route", path: "/venues/v1" })
  })
})

describe("freshArrivals", () => {
  const opened = Date.parse("2026-09-30T09:00:00Z")

  it("announces new unread items once, never old ones at login", () => {
    const old = item({ id: "old", createdAt: "2026-09-29T10:00:00Z" })
    const fresh = item({ id: "fresh" })
    const read = item({ id: "read", isRead: true })
    expect(freshArrivals([old, fresh, read], new Set(), opened).map((n) => n.id)).toEqual(["fresh"])
    expect(freshArrivals([fresh], new Set(["fresh"]), opened)).toEqual([])
  })
})

describe("ago", () => {
  it("is short", () => {
    const now = Date.parse("2026-09-30T10:00:00Z")
    expect(ago("2026-09-30T09:59:30Z", now)).toBe("now")
    expect(ago("2026-09-30T09:55:00Z", now)).toBe("5m")
    expect(ago("2026-09-30T07:00:00Z", now)).toBe("3h")
    expect(ago("2026-09-28T10:00:00Z", now)).toBe("2d")
  })
})
