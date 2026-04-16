import { describe, it, expect } from "vitest"
import { formatCurrency } from "@/lib/formatters"

describe("formatCurrency", () => {
  it("formats whole JOD amounts", () => {
    const result = formatCurrency(25)
    expect(result).toMatch(/25/)
    expect(result).toMatch(/JOD|د\.أ|JD/)
  })

  it("handles zero", () => {
    expect(formatCurrency(0)).toMatch(/0/)
  })

  it("handles fractional amounts", () => {
    const result = formatCurrency(12.5)
    expect(result).toMatch(/12[\.,]5/)
  })
})
