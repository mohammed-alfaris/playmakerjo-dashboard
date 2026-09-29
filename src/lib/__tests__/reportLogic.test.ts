import { describe, expect, it } from "vitest"
import {
  addDays,
  ammanToday,
  axisDirection,
  daysBetween,
  deltaPct,
  deltaPoints,
  headlineMoney,
  heatLevel,
  presetRange,
  previousPeriod,
  readFilters,
  writeFilters,
} from "@/features/reports/reportLogic"

describe("ammanToday", () => {
  it("is already tomorrow in Amman once UTC passes 21:00", () => {
    expect(ammanToday(new Date("2026-01-05T20:59:00Z"))).toBe("2026-01-05")
    expect(ammanToday(new Date("2026-01-05T21:00:00Z"))).toBe("2026-01-06")
  })
})

describe("periods", () => {
  const today = "2026-03-11" // a Wednesday

  it("resolves each preset in Amman days", () => {
    expect(presetRange("today", today)).toEqual({ from: today, to: today })
    expect(presetRange("yesterday", today)).toEqual({ from: "2026-03-10", to: "2026-03-10" })
    expect(presetRange("this_week", today)).toEqual({ from: "2026-03-08", to: today }) // from Sunday
    expect(presetRange("this_month", today)).toEqual({ from: "2026-03-01", to: today })
    expect(presetRange("last_month", today)).toEqual({ from: "2026-02-01", to: "2026-02-28" })
    expect(presetRange("last_30", today)).toEqual({ from: "2026-02-10", to: today })
  })

  it("rolls last month over the year boundary", () => {
    expect(presetRange("last_month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" })
  })

  it("compares with the same number of days right before, as the server does", () => {
    expect(previousPeriod("2026-01-04", "2026-01-10")).toEqual({ from: "2025-12-28", to: "2026-01-03" })
    expect(daysBetween("2026-01-04", "2026-01-10")).toBe(7)
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29")
  })
})

describe("filters in the URL", () => {
  it("round-trips, storing no dates for a preset so a saved link stays current", () => {
    const f = readFilters(new URLSearchParams("p=last_month&venue=v1&compare=1&tab=busy"), "2026-03-11")
    expect(f).toMatchObject({ preset: "last_month", from: "2026-02-01", to: "2026-02-28", venue: "v1", compare: true, tab: "busy" })
    expect(writeFilters(f).toString()).toBe("p=last_month&venue=v1&compare=1&tab=busy")
  })

  it("keeps a valid custom range and falls back to this month for a bad one", () => {
    expect(readFilters(new URLSearchParams("p=custom&from=2026-01-01&to=2026-01-31"), "2026-03-11"))
      .toMatchObject({ preset: "custom", from: "2026-01-01", to: "2026-01-31" })
    for (const bad of ["p=custom&from=2026-02-01&to=2026-01-01", "p=custom&from=x&to=y", "p=custom&from=2020-01-01&to=2026-01-01", "p=nonsense"])
      expect(readFilters(new URLSearchParams(bad), "2026-03-11")).toMatchObject({ preset: "this_month", from: "2026-03-01" })
  })
})

describe("deltas", () => {
  it("is relative for amounts and counts, and silent when it cannot be honest", () => {
    expect(deltaPct(150, 100)).toBe(50)
    expect(deltaPct(50, 100)).toBe(-50)
    expect(deltaPct(10, 0)).toBeNull()
    expect(deltaPct(0, 0)).toBe(0)
    expect(deltaPct(10, null)).toBeNull()
  })

  it("is in points for numbers that are already percentages", () => {
    expect(deltaPoints(25, 20)).toBe(5)
    expect(deltaPoints(25, null)).toBeNull()
  })
})

describe("heatmap and direction", () => {
  it("keeps closed apart from open-but-empty, and clamps", () => {
    expect(heatLevel(null)).toBeNull()
    expect(heatLevel(0)).toBeCloseTo(0.06)
    expect(heatLevel(100)).toBe(1)
    expect(heatLevel(140)).toBe(1)
  })

  it("runs time right to left in Arabic", () => {
    expect(axisDirection("rtl")).toEqual({ reversed: true, yOrientation: "right" })
    expect(axisDirection("ltr")).toEqual({ reversed: false, yOrientation: "left" })
  })
})

describe("tab", () => {
  it("is left to the page when the URL names none or an unknown one", () => {
    expect(readFilters(new URLSearchParams("p=today")).tab).toBe("")
    expect(readFilters(new URLSearchParams("tab=secrets")).tab).toBe("")
    expect(writeFilters(readFilters(new URLSearchParams("p=today"))).has("tab")).toBe(false)
  })
})

describe("headlineMoney", () => {
  it("drops the fils once it is in the thousands", () => {
    const f = (n: number) => String(n)
    expect(headlineMoney(36700.45, f)).toBe("36700")
    expect(headlineMoney(85.5, f)).toBe("85.5")
  })
})
