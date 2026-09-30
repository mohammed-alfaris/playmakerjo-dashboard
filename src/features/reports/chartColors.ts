/**
 * Chart colours, from the theme tokens so both themes stay right. The same meaning keeps the
 * same colour on every chart: cash is always brand, CliQ always indigo.
 */
export const C = {
  brand: "hsl(var(--brand))",
  brand2: "hsl(var(--brand-2))",
  amber: "hsl(var(--amber))",
  indigo: "hsl(var(--indigo))",
  rose: "hsl(var(--rose))",
  ink3: "hsl(var(--ink-3))",
  line: "hsl(var(--line))",
} as const

export const METHOD_COLORS: Record<string, string> = { cash: C.brand, cliq: C.indigo, other: C.amber }
export const CHANNEL_COLORS: Record<string, string> = { app: C.indigo, counter: C.brand, weekly: C.amber, series: C.brand2 }
export const KIND_COLORS: Record<string, string> = { deposit: C.indigo, balance: C.amber, full: C.brand, refund: C.rose, correction: C.ink3 }
export const PALETTE = [C.brand, C.indigo, C.amber, C.rose, C.brand2, C.ink3]
