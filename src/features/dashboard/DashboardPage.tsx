import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Download, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StadiumKpi } from "./StadiumKpi"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { getSummary, getRevenueChart, getTopVenues, getSportsBreakdown } from "@/api/reports"
import { getBookings } from "@/api/bookings"
import { useAuth } from "@/hooks/useAuth"
import { useRole, useOwnerFilter } from "@/hooks/useRole"
import { formatCurrency } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"
import { cn } from "@/lib/utils"

const DATE_RANGES = [
  { label: "7D",  value: 7   },
  { label: "30D", value: 30  },
  { label: "90D", value: 90  },
  { label: "YTD", value: 365 },
] as const

export default function DashboardPage() {
  const { user } = useAuth()
  const { isAdmin, isOwner } = useRole()
  const ownerFilter = useOwnerFilter()
  const { t, lang } = useT()
  const navigate = useNavigate()
  const [days, setDays] = useState<number>(30)

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard-summary", ownerFilter],
    queryFn: () => getSummary(ownerFilter),
  })
  const summary = summaryRes?.data

  const firstName = user?.name?.split(" ")[0] ?? ""
  const now = new Date()
  const locale = lang === "ar" ? "ar-JO" : "en-GB"
  const hour = now.getHours()
  const greetKey = hour < 12 ? "greeting_morning" : hour < 18 ? "greeting_afternoon" : "greeting_evening"
  const dateLabel = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      {/* Greeting strip */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            {dateLabel}
          </div>
          <h1 className="display m-0 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            {t(greetKey as "greeting_morning" | "greeting_afternoon" | "greeting_evening")}
            {firstName ? `, ${firstName}` : ""}
            <span aria-hidden className="ms-1">👋</span>
          </h1>
          <p className="mt-1 text-sm text-ink-3">{t("heres_whats_happening") ?? "Here's what's happening today."}</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
              <Download className="me-1.5 h-3.5 w-3.5" />
              {t("export_csv")}
            </Button>
            <Button size="sm" onClick={() => navigate("/venues")}>
              <Plus className="me-1.5 h-3.5 w-3.5" />
              {t("add_venue")}
            </Button>
          </div>
        )}
      </header>

      {/* KPIs */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StadiumKpi
            label={t("gross_revenue")}
            value={summary ? Math.round(summary.totalRevenue).toLocaleString() : "—"}
            suffix=" JD"
            delta={summary?.revenueChange}
            sparkline={summary?.sparklines?.revenue}
            sparkColor="brand"
            isLoading={summaryLoading}
          />
          <StadiumKpi
            label={t("platform_revenue")}
            value={summary ? Math.round(summary.systemRevenue).toLocaleString() : "—"}
            suffix=" JD"
            sparkline={summary?.sparklines?.systemRevenue}
            sparkColor="amber"
            isLoading={summaryLoading}
          />
          <StadiumKpi
            label={t("total_bookings")}
            value={summary?.totalBookings ?? "—"}
            delta={summary?.bookingsChange}
            sparkline={summary?.sparklines?.bookings}
            sparkColor="indigo"
            isLoading={summaryLoading}
          />
          <StadiumKpi
            label={t("owner_payouts")}
            value={summary ? Math.round(summary.ownerRevenue).toLocaleString() : "—"}
            suffix=" JD"
            sparkline={summary?.sparklines?.ownerRevenue}
            sparkColor="brand-2"
            isLoading={summaryLoading}
          />
        </div>
      )}

      {isOwner && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <StadiumKpi
            label={t("my_venues")}
            value={summary?.totalVenues ?? "—"}
            sparkColor="indigo"
            isLoading={summaryLoading}
          />
          <StadiumKpi
            label={t("my_bookings")}
            value={summary?.totalBookings ?? "—"}
            sparkline={summary?.sparklines?.bookings}
            sparkColor="indigo"
            isLoading={summaryLoading}
          />
          <StadiumKpi
            label={t("my_revenue")}
            value={summary ? Math.round(summary.totalRevenue).toLocaleString() : "—"}
            suffix=" JD"
            sparkline={summary?.sparklines?.ownerRevenue}
            sparkColor="brand"
            isLoading={summaryLoading}
          />
        </div>
      )}

      {isAdmin && (
        <>
          {/* Date range pills */}
          <div className="flex w-fit items-center gap-1 rounded-lg bg-surface-2 p-1">
            {DATE_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setDays(r.value)}
                className={cn(
                  "num rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                  days === r.value
                    ? "bg-card text-ink shadow-stadium-sm"
                    : "text-ink-3 hover:text-ink",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.8fr_1fr]">
            <RevenueTrendCard days={days} />
            <SportsMixCard />
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <TopVenuesCard />
            <ActivityFeedCard ownerFilter={ownerFilter} lang={lang} />
          </div>
        </>
      )}

      {isOwner && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <TopVenuesCard />
          <ActivityFeedCard ownerFilter={ownerFilter} lang={lang} />
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Revenue Trend — dual-line: gross (solid brand) + platform fee (dashed amber)
// ───────────────────────────────────────────────────────────────────────────
function RevenueTrendCard({ days }: { days: number }) {
  const { t } = useT()
  const { data, isLoading } = useQuery({
    queryKey: ["revenue-chart", days],
    queryFn: () => getRevenueChart(days),
  })
  const points = data?.data ?? []

  return (
    <div className="rounded-2xl bg-card p-5 shadow-stadium-sm">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="display m-0 text-[15px] font-semibold">{t("revenue_trend") ?? "Revenue Trend"}</h3>
          <p className="mt-0.5 text-[11px] text-ink-3">
            Last {days} days · Gross vs. platform fee
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Gross
          </span>
          <span className="flex items-center gap-1.5 text-ink-2">
            <svg width="16" height="4">
              <line x1="0" y1="2" x2="16" y2="2" stroke="hsl(var(--amber))" strokeWidth="1.5" strokeDasharray="3 3" />
            </svg>
            Platform
          </span>
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : (
        <RevenueTrendSvg points={points} />
      )}
    </div>
  )
}

function RevenueTrendSvg({ points }: { points: { date: string; revenue: number; systemRevenue: number }[] }) {
  if (!points.length) return <div className="h-[220px] rounded-lg bg-surface-2" />
  const w = 700, h = 220
  const pad = { t: 10, r: 10, b: 24, l: 44 }
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const maxVal = Math.max(1, ...points.map((p) => p.revenue)) * 1.1
  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0
  const y = (v: number) => pad.t + innerH - (v / maxVal) * innerH
  const grossPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${pad.l + i * xStep} ${y(p.revenue)}`).join(" ")
  const platPath  = points.map((p, i) => `${i === 0 ? "M" : "L"}${pad.l + i * xStep} ${y(p.systemRevenue)}`).join(" ")
  const area = grossPath + ` L${pad.l + (points.length - 1) * xStep} ${pad.t + innerH} L${pad.l} ${pad.t + innerH} Z`
  const tickIdx = Array.from(new Set([0, Math.floor(points.length * 0.25), Math.floor(points.length * 0.5), Math.floor(points.length * 0.75), points.length - 1]))

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block h-[220px] w-full">
      <defs>
        <linearGradient id="pm-gross-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line
            x1={pad.l} x2={w - pad.r}
            y1={pad.t + innerH * (1 - f)} y2={pad.t + innerH * (1 - f)}
            stroke="hsl(var(--line))" strokeDasharray="2 4"
          />
          <text
            x={pad.l - 8} y={pad.t + innerH * (1 - f) + 3}
            fontSize="10" fill="hsl(var(--ink-3))"
            textAnchor="end"
            style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace" }}
          >
            {Math.round((maxVal * f) / 1000)}k
          </text>
        </g>
      ))}
      <path d={area} fill="url(#pm-gross-fill)" />
      <path d={grossPath} stroke="hsl(var(--brand))" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <path d={platPath} stroke="hsl(var(--amber))" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
      {tickIdx.map((i) => (
        <text
          key={i} x={pad.l + i * xStep} y={h - 6}
          fontSize="10" fill="hsl(var(--ink-3))" textAnchor="middle"
          style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace" }}
        >
          {points[i]?.date.slice(5)}
        </text>
      ))}
    </svg>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Sports Mix — horizontal bars showing share of bookings per sport
// ───────────────────────────────────────────────────────────────────────────
const SPORT_COLORS: Record<string, string> = {
  football:   "hsl(var(--brand))",
  basketball: "hsl(var(--amber))",
  tennis:     "hsl(var(--indigo))",
  padel:      "hsl(var(--rose))",
  volleyball: "hsl(var(--brand-2))",
  swimming:   "hsl(var(--indigo))",
  cricket:    "hsl(var(--brand-2))",
  squash:     "hsl(var(--rose))",
}

function SportsMixCard() {
  const { t } = useT()
  const { data, isLoading } = useQuery({
    queryKey: ["sports-breakdown"],
    queryFn: () => getSportsBreakdown(),
  })
  const rows = data?.data ?? []
  const total = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows])

  return (
    <div className="pitch-bg relative overflow-hidden rounded-2xl bg-card p-5 shadow-stadium-sm">
      <div className="relative z-10">
        <h3 className="display m-0 text-[15px] font-semibold">{t("sports_mix") ?? "Sports Mix"}</h3>
        <p className="mt-0.5 text-[11px] text-ink-3">Share of bookings by sport</p>
        {isLoading ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-sm text-ink-3">No bookings yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.slice(0, 6).map((s) => {
              const share = total ? Math.round((s.count / total) * 100) : 0
              const key = s.sport.toLowerCase()
              const color = SPORT_COLORS[key] ?? "hsl(var(--ink-2))"
              return (
                <div key={s.sport}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-ink">{s.sport}</span>
                    <span className="num font-mono text-ink-3">{share}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Top Venues — ranked list w/ mini inline revenue bar
// ───────────────────────────────────────────────────────────────────────────
function TopVenuesCard() {
  const { t } = useT()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ["top-venues"],
    queryFn: () => getTopVenues(),
  })
  const rows = data?.data ?? []
  const max = Math.max(1, ...rows.map((r) => r.revenue))

  return (
    <div className="rounded-2xl bg-card p-5 shadow-stadium-sm">
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="display m-0 text-[15px] font-semibold">{t("top_venues") ?? "Top Venues"}</h3>
        <Button variant="ghost" size="sm" className="text-ink-3 hover:text-ink" onClick={() => navigate("/venues")}>
          {t("view_all") ?? "View all"}
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-3">No venues with revenue yet.</p>
      ) : (
        <ol className="space-y-2.5">
          {rows.slice(0, 5).map((v, i) => (
            <li
              key={v.id}
              onClick={() => navigate(`/venues/${v.id}`)}
              className="group flex cursor-pointer items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
            >
              <span className="font-mono w-6 text-[11px] text-ink-3">#{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-ink">{v.name}</div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(v.revenue / max) * 100}%` }} />
                </div>
              </div>
              <span className="num font-mono text-xs font-semibold text-ink-2">
                {formatCurrency(v.revenue)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Activity Feed — recent bookings with pulse "LIVE" dot
// ───────────────────────────────────────────────────────────────────────────
interface FeedBooking {
  id: string
  venue: { name: string }
  player: { name: string }
  sport: string
  date: string
  status: string
}

function ActivityFeedCard({ ownerFilter, lang }: { ownerFilter: { owner_id?: string }; lang: string }) {
  const { t } = useT()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-recent-bookings", ownerFilter],
    queryFn: () => getBookings({ page: 1, limit: 6, sort: "-date", ...ownerFilter }),
  })
  const bookings = ((data?.data ?? []) as FeedBooking[])

  return (
    <div className="rounded-2xl bg-card p-5 shadow-stadium-sm">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="display m-0 text-[15px] font-semibold">{t("recent_activity") ?? "Recent Activity"}</h3>
          <span className="pm-pulse h-1.5 w-1.5 rounded-full bg-brand" />
        </div>
        <Button variant="ghost" size="sm" className="text-ink-3 hover:text-ink" onClick={() => navigate("/bookings")}>
          {t("view_all") ?? "View all"}
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-ink-3">No recent activity.</p>
      ) : (
        <ul className="flex flex-col">
          {bookings.map((b, i) => (
            <li
              key={b.id}
              className={cn(
                "flex items-center gap-3 py-2.5",
                i < bookings.length - 1 && "border-b border-dashed border-line-strong/50",
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold uppercase text-ink-2">
                {b.sport.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] leading-tight">
                  <span className="font-semibold text-ink">{b.player.name}</span>
                  <span className="text-ink-3"> · </span>
                  <span className="font-medium text-ink-2">{b.venue.name}</span>
                </div>
                <div className="font-mono mt-0.5 text-[11px] text-ink-3">
                  {b.id} · {new Date(b.date).toLocaleString(lang === "ar" ? "ar-JO" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <StatusBadge status={b.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
