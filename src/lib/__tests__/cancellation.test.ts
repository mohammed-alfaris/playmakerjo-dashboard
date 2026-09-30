import { describe, expect, it } from "vitest"
import { cancelPreview, refundFor, slotStartMs } from "../cancellation"
import type { Booking } from "@/api/bookings"

const booking = (over: Partial<Booking> = {}, freeCancelHours = 24): Booking => ({
  id: "b1", venue: { id: "v1", name: "Venue", freeCancelHours }, player: { id: "p", name: "P" },
  sport: "football", date: "2026-10-10T00:00:00", startTime: "18:00", duration: 60, amount: 40,
  totalAmount: 40, amountPaid: 40, status: "confirmed", ...over,
})

// 18:00 in Amman on 10 Oct is 15:00 UTC.
const start = Date.UTC(2026, 9, 10, 15, 0)
const hoursBefore = (h: number) => start - h * 3_600_000

describe("slotStartMs", () => {
  it("reads the date and time as Amman wall-clock time", () => {
    expect(slotStartMs("2026-10-10", "18:00")).toBe(start)
    expect(slotStartMs("2026-10-10T00:00:00", "18:00")).toBe(start)
  })
  it("has no start without a time", () => {
    expect(slotStartMs("2026-10-10", null)).toBeNull()
    expect(slotStartMs("2026-10-10", "later")).toBeNull()
  })
})

describe("cancelPreview", () => {
  it("is free exactly at the window and after it, not a minute inside it", () => {
    expect(cancelPreview(booking(), hoursBefore(24)).free).toBe(true)
    expect(cancelPreview(booking(), hoursBefore(48)).free).toBe(true)
    expect(cancelPreview(booking(), hoursBefore(24) + 60_000).free).toBe(false)
  })
  it("a zero-hour window is always free until kick-off", () => {
    expect(cancelPreview(booking({}, 0), hoursBefore(0.1)).free).toBe(true)
  })
  it("a booking without a start time counts as late", () => {
    expect(cancelPreview(booking({ startTime: undefined }), hoursBefore(100)).free).toBe(false)
  })
  it("defaults to the server's 24 hours when the venue does not say", () => {
    const b = booking()
    delete b.venue.freeCancelHours
    expect(cancelPreview(b, hoursBefore(23)).freeCancelHours).toBe(24)
  })
})

describe("refundFor", () => {
  const early = cancelPreview(booking(), hoursBefore(48))
  const late = cancelPreview(booking(), hoursBefore(2))
  it("follows the rule by default", () => {
    expect(refundFor(early, "policy")).toBe(40)
    expect(refundFor(late, "policy")).toBe(0)
  })
  it("lets the venue refund anyway, or keep the money anyway", () => {
    expect(refundFor(late, "all")).toBe(40)
    expect(refundFor(early, "none")).toBe(0)
  })
  it("refunds nothing when nothing was paid", () => {
    expect(refundFor(cancelPreview(booking({ amountPaid: 0 }), hoursBefore(48)), "all")).toBe(0)
  })
})
