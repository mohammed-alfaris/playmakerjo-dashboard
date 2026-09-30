import { describe, expect, it } from "vitest"
import { invoiceState, lineText, periodLabel, periodOf, periodOptions, shiftPeriod } from "../billing"

describe("periods", () => {
  it("moves across year ends", () => {
    expect(shiftPeriod("2026-12", 1)).toBe("2027-01")
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12")
    expect(shiftPeriod("2026-10", 13)).toBe("2027-11")
  })
  it("offers next month first, then back three", () => {
    expect(periodOptions("2026-10-14")).toEqual(["2026-11", "2026-10", "2026-09", "2026-08", "2026-07"])
    expect(periodOf("2026-10-14")).toBe("2026-10")
  })
  it("names the month in the reader's language", () => {
    expect(periodLabel("2026-10", "en")).toBe("October 2026")
    expect(periodLabel("2026-10", "ar")).not.toBe("October 2026")
  })
})

describe("invoiceState", () => {
  it("says overdue only for an issued invoice past its date", () => {
    expect(invoiceState({ status: "issued", overdue: true })).toBe("overdue")
    expect(invoiceState({ status: "issued", overdue: false })).toBe("issued")
    expect(invoiceState({ status: "paid", overdue: false })).toBe("paid")
  })
})

describe("lineText", () => {
  it("uses the Arabic text when there is one", () => {
    expect(lineText({ description: "Setup", descriptionAr: "تأسيس" }, "ar")).toBe("تأسيس")
    expect(lineText({ description: "Launch discount", descriptionAr: null }, "ar")).toBe("Launch discount")
    expect(lineText({ description: "Setup", descriptionAr: "تأسيس" }, "en")).toBe("Setup")
  })
})
