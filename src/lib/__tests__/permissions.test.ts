import { describe, expect, it } from "vitest"
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  formatUsage,
  isAtLimit,
  legacyPermissions,
  togglePermission,
  usageRatio,
} from "../permissions"

describe("permission catalog", () => {
  it("places every key in exactly one group of the role editor", () => {
    const grouped = PERMISSION_GROUPS.flatMap((g) => g.keys)
    expect([...grouped].sort()).toEqual([...PERMISSIONS].sort())
  })

  it("starts every group with its view key, which the rest depend on", () => {
    for (const { group, keys } of PERMISSION_GROUPS) expect(keys[0]).toBe(`${group}.view`)
  })
})

describe("legacyPermissions", () => {
  // These must match what the migration gave "Front desk" and "View only", or a clerk's
  // buttons would change for the moment between login and /users/me answering.
  it("maps write to everything but reports", () => {
    expect(legacyPermissions("write")).toEqual(PERMISSIONS.filter((p) => p !== "reports.view"))
  })

  it("maps read, and anything unknown, to the view-only set", () => {
    const read = ["bookings.view", "payments.view", "customers.view", "customers.export", "standing.view"]
    expect(legacyPermissions("read")).toEqual(read)
    expect(legacyPermissions(null)).toEqual(read)
  })
})

describe("togglePermission", () => {
  it("turning on a manage key also turns on seeing its area", () => {
    expect(togglePermission([], "payments.record", true)).toEqual(["payments.view", "payments.record"])
  })

  it("turning off the view key clears the whole area", () => {
    const start = ["customers.view", "customers.export", "customers.manage", "bookings.view"]
    expect(togglePermission(start, "customers.view", false)).toEqual(["bookings.view"])
  })

  it("turning off a manage key leaves seeing alone", () => {
    expect(togglePermission(["bookings.view", "bookings.manage"], "bookings.manage", false)).toEqual(["bookings.view"])
  })

  it("returns catalog order and drops keys it does not know", () => {
    expect(togglePermission(["reports.view", "legacy.thing", "bookings.view"], "standing.view", true))
      .toEqual(["bookings.view", "standing.view", "reports.view"])
  })
})

describe("usage", () => {
  it("treats null max as unlimited", () => {
    expect(isAtLimit({ used: 500, max: null })).toBe(false)
    expect(formatUsage({ used: 4, max: null })).toBe("4")
    expect(usageRatio({ used: 4, max: null })).toBe(0)
  })

  it("is at the limit when used reaches max, and past it after a limit is lowered", () => {
    expect(isAtLimit({ used: 1, max: 2 })).toBe(false)
    expect(isAtLimit({ used: 2, max: 2 })).toBe(true)
    expect(isAtLimit({ used: 3, max: 1 })).toBe(true)
    expect(usageRatio({ used: 3, max: 1 })).toBe(1)
  })

  it("a zero limit is full from the start", () => {
    expect(isAtLimit({ used: 0, max: 0 })).toBe(true)
    expect(usageRatio({ used: 0, max: 0 })).toBe(1)
    expect(formatUsage({ used: 0, max: 0 })).toBe("0 / 0")
  })
})
