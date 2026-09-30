import { describe, it, expect } from "vitest"
import { slotFitsCapacity, type Occupant } from "@/lib/timelineDesign"

/**
 * The time dropdown in "new booking" offered every half hour the venue was open, whatever
 * was already booked. A clerk picked a taken slot, typed the customer's name and phone,
 * hit save, and only then got a 409 — with the customer still on the phone, and the
 * conflict visible on the schedule behind the dialog the whole time.
 *
 * This rule MIRRORS the server's AvailabilityHelper.PitchHasCapacity. It is a UX filter,
 * not the safety mechanism: the server re-checks inside a venue row lock and remains the
 * only thing that actually prevents a double booking. But a mirror can drift from what it
 * mirrors, so the arithmetic is pinned here.
 */

/** 11-a-side splitting to 8 and 6 → four capacity units, the fixture used across the suite. */
const SUBDIVIDABLE = { sport: "football", parentSize: "11", subSizes: ["8", "6"] }

/** A basketball court: one game at a time. */
const SINGLE = { sport: "basketball", parentSize: null, subSizes: [] }

const at = (startMin: number, duration: number, pitchSize?: string | null): Occupant =>
  ({ startMin, duration, pitchSize })

describe("slotFitsCapacity", () => {
  it("offers an empty pitch", () => {
    expect(slotFitsCapacity(SINGLE, [], 18 * 60, 60)).toBe(true)
  })

  it("refuses a single-capacity pitch that is already taken", () => {
    expect(slotFitsCapacity(SINGLE, [at(18 * 60, 60)], 18 * 60, 60)).toBe(false)
  })

  it("allows a booking that merely touches the end of another", () => {
    // 18:00-19:00 and 19:00-20:00 do not overlap. Treating touching as overlapping would
    // silently delete every back-to-back slot from the dropdown — the most common shape of
    // a busy evening.
    expect(slotFitsCapacity(SINGLE, [at(18 * 60, 60)], 19 * 60, 60)).toBe(true)
  })

  it("catches a partial overlap from either direction", () => {
    expect(slotFitsCapacity(SINGLE, [at(18 * 60, 60)], 18 * 60 + 30, 60)).toBe(false)
    expect(slotFitsCapacity(SINGLE, [at(18 * 60, 60)], 17 * 60 + 30, 60)).toBe(false)
  })

  it("fits four 6-a-side games on an 11-a-side pitch, and refuses the fifth", () => {
    const six = (n: number) => Array.from({ length: n }, () => at(18 * 60, 60, "6"))
    expect(slotFitsCapacity(SUBDIVIDABLE, six(3), 18 * 60, 60, "6")).toBe(true)
    expect(slotFitsCapacity(SUBDIVIDABLE, six(4), 18 * 60, 60, "6")).toBe(false)
  })

  it("counts a half-pitch as half the budget", () => {
    // One 8-a-side is 2 of 4 units, so another 8 fits and a full 11 does not.
    const half = [at(18 * 60, 60, "8")]
    expect(slotFitsCapacity(SUBDIVIDABLE, half, 18 * 60, 60, "8")).toBe(true)
    expect(slotFitsCapacity(SUBDIVIDABLE, half, 18 * 60, 60, "11")).toBe(false)
  })

  it("lets one full-size booking consume the whole pitch", () => {
    expect(slotFitsCapacity(SUBDIVIDABLE, [at(18 * 60, 60, "11")], 18 * 60, 60, "6")).toBe(false)
  })

  it("ignores occupants at other times of day", () => {
    expect(slotFitsCapacity(SUBDIVIDABLE, [at(10 * 60, 60, "11")], 18 * 60, 60, "11")).toBe(true)
  })

  it("treats a standing reservation exactly like a booking", () => {
    // Permanents and bookings arrive in the same list on purpose — the pitch does not care
    // which table the thing holding it came from.
    expect(slotFitsCapacity(SINGLE, [at(19 * 60, 90)], 20 * 60, 60)).toBe(false)
  })

  it("handles a long booking spanning several candidate slots", () => {
    const threeHours = [at(18 * 60, 180, "11")]
    for (const start of [18 * 60, 19 * 60, 20 * 60]) {
      expect(slotFitsCapacity(SUBDIVIDABLE, threeHours, start, 60, "6")).toBe(false)
    }
    expect(slotFitsCapacity(SUBDIVIDABLE, threeHours, 21 * 60, 60, "6")).toBe(true)
  })
})
