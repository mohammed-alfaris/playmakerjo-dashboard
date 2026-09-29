import type { ReactNode } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/shared/design/Card"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/i18n/LanguageContext"
import type { OccupancyCell } from "@/api/reports"
import { cn } from "@/lib/utils"
import { C, PALETTE } from "./chartColors"
import { axisDirection, heatLevel } from "./reportLogic"

// Animations are off everywhere: the same charts are printed, and a chart caught mid-animation
// prints half-drawn.

/** A titled card for one report block. */
export function ReportCard({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn("p-5 break-inside-avoid", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--ink))]">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-[hsl(var(--ink-3))]">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <Skeleton className="w-full rounded-xl" style={{ height }} />
}

export function Empty({ children }: { children?: ReactNode }) {
  const { t } = useT()
  return (
    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-xs text-[hsl(var(--ink-3))]">
      {children ?? t("report_no_data")}
    </div>
  )
}

/** "12 Mar" in either language, from an Amman date. */
function dayLabel(iso: string, lang: string) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${iso}T00:00:00Z`))
}

function compact(n: number) {
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`
}

export interface Series {
  key: string
  label: string
  color: string
}

/**
 * Values per day, as bars. Stacked when the series are parts of one whole (cash + CliQ =
 * collected), side by side when they are different measures.
 */
export function DailyBars<T extends { date: string }>({
  data,
  series,
  stacked = true,
  format = compact,
  height = 240,
}: {
  data: T[]
  series: Series[]
  stacked?: boolean
  format?: (n: number) => string
  height?: number
}) {
  const { lang } = useT()
  const axis = axisDirection(lang === "ar" ? "rtl" : "ltr")
  const hasData = data.some((d) => series.some((s) => Number((d as Record<string, unknown>)[s.key]) > 0))
  if (!hasData) return <Empty />

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap={data.length > 40 ? 0 : "20%"}>
          <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="2 4" />
          <XAxis
            dataKey="date"
            reversed={axis.reversed}
            tickFormatter={(d: string) => dayLabel(d, lang)}
            tick={{ fontSize: 10, fill: C.ink3 }}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
          />
          <YAxis
            orientation={axis.yOrientation}
            tickFormatter={format}
            tick={{ fontSize: 10, fill: C.ink3 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--surface-2))" }}
            labelFormatter={(d) => dayLabel(String(d), lang)}
            formatter={(v, name) => [format(Number(v)), series.find((s) => s.key === name)?.label ?? String(name)]}
            contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--line))", background: "hsl(var(--card))", fontSize: 12 }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId={stacked ? "a" : undefined}
              fill={s.color}
              isAnimationActive={false}
              radius={stacked ? (i === series.length - 1 ? [3, 3, 0, 0] : 0) : [3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[hsl(var(--ink-2))]">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          {it.label}
          {it.value && <span className="num font-semibold text-[hsl(var(--ink))]">{it.value}</span>}
        </span>
      ))}
    </div>
  )
}

/** Parts of a whole, with the legend carrying the numbers so nothing needs a hover. */
export function Donut({
  items,
  format,
}: {
  items: { key: string; label: string; value: number; color?: string }[]
  format: (n: number) => string
}) {
  const total = items.reduce((s, i) => s + i.value, 0)
  if (total <= 0) return <Empty />
  const colored = items.map((it, i) => ({ ...it, color: it.color ?? PALETTE[i % PALETTE.length] }))

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-[150px] w-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={colored} dataKey="value" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2}
              stroke="none" isAnimationActive={false}>
              {colored.map((it) => <Cell key={it.key} fill={it.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {colored.map((it) => (
          <li key={it.key} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
              {it.label}
            </span>
            <span className="num font-semibold">
              {format(it.value)}
              <span className="ms-1.5 text-xs font-normal text-[hsl(var(--ink-3))]">
                {Math.round((it.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A ranked list with proportional bars — readable at a glance and in print. */
export function BarList({
  items,
  format,
  color = C.brand,
  max,
  limit = 8,
}: {
  items: { key: string; label: ReactNode; value: number; sub?: ReactNode }[]
  format: (n: number) => string
  color?: string
  /** Scale; defaults to the largest value (use 100 for percentages). */
  max?: number
  limit?: number
}) {
  if (items.length === 0) return <Empty />
  const top = max ?? Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="space-y-3">
      {items.slice(0, limit).map((it) => (
        <li key={it.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{it.label}</span>
            <span className="num shrink-0 font-semibold">{format(it.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (it.value / top) * 100)}%`, background: color }} />
          </div>
          {it.sub && <div className="mt-1 text-xs text-[hsl(var(--ink-3))]">{it.sub}</div>}
        </li>
      ))}
    </ul>
  )
}

/**
 * Weekday × hour occupancy. Only hours when something was open get a column, so a venue open
 * 16:00–01:00 is not drawn as a mostly-empty day. Closed cells are hatched, open-but-empty
 * cells faintly tinted — the difference between "nobody came" and "we were shut".
 */
export function Heatmap({ grid }: { grid: OccupancyCell[] }) {
  const { t } = useT()
  const hours = [...new Set(grid.filter((c) => c.pct != null).map((c) => c.hour))].sort((a, b) => a - b)
  if (hours.length === 0) return <Empty>{t("report_no_hours")}</Empty>
  const cell = (d: number, h: number) => grid.find((c) => c.day === d && c.hour === h)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th />
            {hours.map((h) => (
              <th key={h} className="num px-0.5 text-center text-[10px] font-medium text-[hsl(var(--ink-3))]">
                {String(h).padStart(2, "0")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <tr key={d}>
              <th className="whitespace-nowrap pe-2 text-start text-xs font-medium text-[hsl(var(--ink-2))]">
                {t(`dow_short_${d}` as Parameters<typeof t>[0])}
              </th>
              {hours.map((h) => {
                const c = cell(d, h)
                const level = heatLevel(c?.pct ?? null)
                const label = `${t(`dow_short_${d}` as Parameters<typeof t>[0])} ${String(h).padStart(2, "0")}:00 — ${
                  c?.pct == null ? t("report_closed") : `${Math.round(c.pct)}%`
                }`
                return (
                  <td
                    key={h}
                    title={label}
                    aria-label={label}
                    tabIndex={0}
                    className="h-7 min-w-[22px] rounded-[4px] focus:outline-none focus:ring-2 focus:ring-ring"
                    style={
                      level == null
                        ? { background: "repeating-linear-gradient(45deg, hsl(var(--surface-2)), hsl(var(--surface-2)) 3px, transparent 3px, transparent 6px)" }
                        : { background: `hsl(var(--brand) / ${level.toFixed(2)})` }
                    }
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[hsl(var(--ink-3))]">
        <span>0%</span>
        <span className="h-2 w-28 rounded-full" style={{ background: "linear-gradient(to right, hsl(var(--brand) / 0.06), hsl(var(--brand)))" }} />
        <span>100%</span>
        <span className="ms-3 inline-block h-2.5 w-4 rounded-sm"
          style={{ background: "repeating-linear-gradient(45deg, hsl(var(--surface-2)), hsl(var(--surface-2)) 3px, transparent 3px, transparent 6px)" }} />
        <span>{t("report_closed")}</span>
      </div>
    </div>
  )
}

/** A plain table that prints well; the report tables are short and need no paging. */
export function SimpleTable({
  columns,
  rows,
  empty,
}: {
  columns: { key: string; label: string; align?: "start" | "end"; className?: string }[]
  rows: { key: string; cells: Record<string, ReactNode>; onClick?: () => void }[]
  empty?: string
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-[hsl(var(--ink-3))]">
            {columns.map((c) => (
              <th key={c.key} className={cn("px-2 py-2 font-medium", c.align === "end" ? "text-end" : "text-start", c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              onClick={r.onClick}
              className={cn("border-b last:border-0", r.onClick && "cursor-pointer hover:bg-[hsl(var(--surface-2))]")}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-2 py-2", c.align === "end" ? "num text-end" : "text-start", c.className)}>
                  {r.cells[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
