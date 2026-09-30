import type { Invoice, InvoiceLine } from "@/api/billing"

/** "2026-10" from an Amman calendar date "2026-10-14". */
export function periodOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/** The month `n` months after `period` (negative for before). */
export function shiftPeriod(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

/**
 * Months offered for generating invoices, newest first: a couple ahead (a month is usually
 * invoiced at its start, sometimes before) and a few behind (a late run, or a correction).
 */
export function periodOptions(today: string, ahead = 1, back = 3): string[] {
  const current = periodOf(today)
  const out: string[] = []
  for (let n = ahead; n >= -back; n--) out.push(shiftPeriod(current, n))
  return out
}

/** "October 2026" / "تشرين الأول 2026". */
export function periodLabel(period: string, lang: "en" | "ar"): string {
  const [y, m] = period.split("-").map(Number)
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)))
}

/** What the invoice badge says: an issued invoice past its due date reads "overdue". */
export function invoiceState(inv: Pick<Invoice, "status" | "overdue">): "draft" | "issued" | "overdue" | "paid" | "void" {
  return inv.status === "issued" && inv.overdue ? "overdue" : inv.status
}

/** A line in the reader's language; the Arabic text is optional (an admin's own adjustment). */
export function lineText(line: Pick<InvoiceLine, "description" | "descriptionAr">, lang: "en" | "ar"): string {
  return lang === "ar" && line.descriptionAr ? line.descriptionAr : line.description
}
