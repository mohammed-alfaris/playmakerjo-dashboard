import { describe, it, expect } from "vitest"
import { daySlots, unitWeight, type PitchDay } from "@/lib/daySlots"

/**
 * The new-booking grid shows every start time, free or taken, from the server's own
 * availability answer. Pinned here: the capacity arithmetic (a 7-a-side splits into two
 * 5-a-sides), overnight hours, and today's past times dropping out.
 */

const day = (over: Partial<PitchDay> = {}): PitchDay => ({
  operatingHours: { open: "16:00", close: "20:00" },
  bookedSlots: [],
  capacityUnits: 1,
  ...over,
})
const free = (d: PitchDay, o: Parameters<typeof daySlots>[1]) =>
  daySlots(d, o).filter((s) => s.free).map((s) => s.time)

describe("daySlots", () => {
  it("lists every half hour that fits before closing", () => {
    expect(daySlots(day(), { duration: 60 }).map((s) => s.time))
      .toEqual(["16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"])
  })

  it("marks overlapping times taken, not hidden", () => {
    const d = day({ bookedSlots: [{ startTime: "17:00", duration: 60, unitWeight: 1 }] })
    const slots = daySlots(d, { duration: 60 })
    expect(slots.find((s) => s.time === "16:30")?.free).toBe(false)
    expect(slots.find((s) => s.time === "17:00")?.free).toBe(false)
    expect(slots.find((s) => s.time === "17:30")?.free).toBe(false)
    expect(slots.find((s) => s.time === "18:00")?.free).toBe(true)
  })

  it("fits a 5-a-side next to another 5-a-side on a 7-a-side pitch, but not a full 7", () => {
    const d = day({ capacityUnits: 2, bookedSlots: [{ startTime: "18:00", duration: 60, unitWeight: 1 }] })
    expect(free(d, { duration: 60, size: "5" })).toContain("18:00")
    expect(free(d, { duration: 60, size: "7" })).not.toContain("18:00")
  })

  it("treats a block as using the whole pitch", () => {
    const d = day({ capacityUnits: 2, bookedSlots: [{ startTime: "16:00", duration: 120, unitWeight: 2 }] })
    expect(free(d, { duration: 60, size: "5" })).toEqual(["18:00", "18:30", "19:00"])
  })

  it("reads a booking after midnight on an overnight day as late, not early", () => {
    const d = day({ operatingHours: { open: "18:00", close: "02:00" }, bookedSlots: [{ startTime: "01:00", duration: 60 }] })
    // 23:30 for an hour does not touch 01:00; nothing at 18:00 is blocked by it either.
    expect(free(d, { duration: 60 })).toContain("18:00")
    expect(free(d, { duration: 60 })).toContain("23:30")
  })

  it("drops times already past today, with half an hour's notice", () => {
    expect(daySlots(day(), { duration: 60, nowMin: 16 * 60 + 40 }).map((s) => s.time))
      .toEqual(["17:30", "18:00", "18:30", "19:00"])
  })

  it("is empty on a closed day", () => {
    expect(daySlots(day({ operatingHours: null }), { duration: 60 })).toEqual([])
  })

  it("weighs sizes like the server", () => {
    expect([unitWeight("11"), unitWeight("8"), unitWeight("7"), unitWeight("6"), unitWeight("5"), unitWeight(null)])
      .toEqual([4, 2, 2, 1, 1, 1])
  })
})
