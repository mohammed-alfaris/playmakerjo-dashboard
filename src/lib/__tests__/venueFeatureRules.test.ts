import { describe, it, expect } from "vitest"
import {
  addCustomLabel, cleanLabel, MAX_CUSTOM_LABEL_LENGTH, MAX_CUSTOM_PER_VENUE,
} from "@/lib/venueFeatureRules"

/**
 * These rules MIRROR the API's Helpers/VenueFeatureRules.cs — same limits, same trimming, same
 * typed-label-to-catalog mapping. The server re-applies all of it on save and stays the
 * authority; this suite exists because a mirror silently drifting from what it mirrors is
 * exactly how a form ends up accepting input the API then rejects.
 */

const CATALOG = [
  { id: "vf-parking", name: "Parking", nameAr: "موقف سيارات" },
  { id: "vf-prayer-room", name: "Prayer room", nameAr: "مصلى" },
]

describe("cleanLabel", () => {
  it("trims and collapses internal whitespace", () => {
    expect(cleanLabel("  Kids   corner ")).toBe("Kids corner")
  })
})

describe("addCustomLabel", () => {
  it("adds a new typed label, cleaned", () => {
    expect(addCustomLabel("  Shaded   benches ", [], CATALOG)).toEqual({ kind: "custom", label: "Shaded benches" })
  })

  it("selects the catalog feature when the label is one, in either language and any case", () => {
    expect(addCustomLabel("  parking ", [], CATALOG)).toEqual({ kind: "catalog", id: "vf-parking" })
    expect(addCustomLabel("PRAYER ROOM", [], CATALOG)).toEqual({ kind: "catalog", id: "vf-prayer-room" })
    expect(addCustomLabel("مصلى", [], CATALOG)).toEqual({ kind: "catalog", id: "vf-prayer-room" })
  })

  it("refuses an empty label", () => {
    expect(addCustomLabel("   ", [], CATALOG)).toEqual({ kind: "empty" })
  })

  it("refuses a duplicate, ignoring case", () => {
    expect(addCustomLabel("shade", ["Shade"], CATALOG)).toEqual({ kind: "duplicate" })
  })

  it("allows exactly the server's length limit and no more", () => {
    expect(addCustomLabel("x".repeat(MAX_CUSTOM_LABEL_LENGTH), [], CATALOG).kind).toBe("custom")
    expect(addCustomLabel("x".repeat(MAX_CUSTOM_LABEL_LENGTH + 1), [], CATALOG)).toEqual({ kind: "too_long" })
  })

  it("stops at the server's per-venue count", () => {
    const full = Array.from({ length: MAX_CUSTOM_PER_VENUE }, (_, i) => `Extra ${i}`)
    expect(addCustomLabel("One more", full, CATALOG)).toEqual({ kind: "too_many" })
    // A catalog match is not a typed label, so it is still allowed when the typed list is full.
    expect(addCustomLabel("Parking", full, CATALOG)).toEqual({ kind: "catalog", id: "vf-parking" })
  })

  it("uses the same limits as the API", () => {
    expect(MAX_CUSTOM_LABEL_LENGTH).toBe(40)
    expect(MAX_CUSTOM_PER_VENUE).toBe(15)
  })
})
