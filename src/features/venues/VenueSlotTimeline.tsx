import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Plus,
  Clock,
  Loader2,
  BarChart3,
  CalendarCheck,
  Coins,
} from "lucide-react"
import { toast } from "sonner"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import api from "@/api/axios"
import { getBookings, type Booking } from "@/api/bookings"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { formatCurrency } from "@/lib/formatters"
import type { OperatingHours, DayHours } from "@/lib/types"
import { StatusBadge } from "@/components/shared/StatusBadge"

// ---- helpers ----------------------------------------------------------------

const DAY_KEY_PAIRS: [string, string][] = [
  ["sun", "sunday"],
  ["mon", "monday"],
  ["tue", "tuesday"],
  ["wed", "wednesday"],
  ["thu", "thursday"],
  ["fri", "friday"],
  ["sat", "saturday"],
]

function resolveDay(oh: OperatingHours | undefined, weekdayIdx: number): DayHours | undefined {
  if (!oh) return undefined
  const [short, long] = DAY_KEY_PAIRS[weekdayIdx]
  const hours = oh as unknown as Record<string, DayHours | undefined>
  return hours[short] ?? hours[long]
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + n)
  return nd
}

function parseTime(hhmm: string | undefined): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

function formatHour(mins: number): string {
  // Normalize into 0-24h — overnight sessions use an extended frame that may
  // exceed 1440 minutes; display values should still read as 00:00, 01:00, …
  const normalized = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function formatMinutes(mins: number): string {
  const normalized = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  const suffix = h >= 12 ? "PM" : "AM"
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`
}

type SlotState = "open" | "past" | "booked" | "spanned"

interface HourCell {
  /** Start offset in minutes from midnight */
  startMin: number
  state: SlotState
  /** For booked cells, how many 1-hour slots this booking spans (1 or 2) */
  span?: number
  booking?: Booking
  pendingReview?: boolean
}

/**
 * Build hour-bucket cells (1 per operating hour). Bookings that span multiple
 * hours collapse adjacent cells into a single cell with span=N, and following
 * cells get state="spanned" so they aren't rendered.
 */
function buildHourCells({
  operatingHours,
  weekdayIdx,
  bookings,
  now,
  isToday,
  isPastDate,
}: {
  operatingHours?: OperatingHours
  weekdayIdx: number
  bookings: Booking[]
  now: Date
  isToday: boolean
  isPastDate: boolean
}): { cells: HourCell[]; startHour: number; endHour: number } {
  const dh = resolveDay(operatingHours, weekdayIdx)
  if (!dh || dh.closed) return { cells: [], startHour: 0, endHour: 0 }
  const start = parseTime(dh.open)
  const end = parseTime(dh.close)
  if (start == null || end == null) return { cells: [], startHour: 0, endHour: 0 }
  // Overnight: close <= open means the venue crosses midnight. Work in an
  // extended frame (minutes may exceed 1440); display helpers mod by 24h.
  const isOvernight = end <= start
  const startHour = Math.floor(start / 60)
  const endExtended = isOvernight ? end + 24 * 60 : end
  const endHour = Math.ceil(endExtended / 60)

  const rawNowMin = now.getHours() * 60 + now.getMinutes()
  const nowInFrame = isOvernight && rawNowMin < start ? rawNowMin + 24 * 60 : rawNowMin
  const nowMin = isToday ? nowInFrame : -1
  const cells: HourCell[] = []

  for (let h = startHour; h < endHour; h++) {
    const hourStart = h * 60
    const hourEnd = hourStart + 60
    let state: SlotState = "open"
    if (isPastDate) state = "past"
    else if (isToday && hourEnd <= nowMin) state = "past"

    let booking: Booking | undefined
    let pending = false
    for (const b of bookings) {
      let bStart = parseTime(b.startTime)
      if (bStart == null) continue
      // Bookings that start after midnight on an overnight session are stored
      // with a small start time (e.g. 01:00). Shift into the extended frame.
      if (isOvernight && bStart < start) bStart += 24 * 60
      const bEnd = bStart + (b.duration ?? 0)
      if (hourStart < bEnd && hourEnd > bStart) {
        booking = b
        state = "booked"
        pending = b.paymentProofStatus === "pending_review"
        break
      }
    }
    cells.push({ startMin: hourStart, state, booking, pendingReview: pending })
  }

  // Collapse consecutive booked cells belonging to the same booking id
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    if (c.state !== "booked" || !c.booking) continue
    let span = 1
    for (let j = i + 1; j < cells.length; j++) {
      if (cells[j].state === "booked" && cells[j].booking?.id === c.booking.id) {
        cells[j].state = "spanned"
        span += 1
      } else {
        break
      }
    }
    c.span = span
    i += span - 1
  }

  return { cells, startHour, endHour }
}

// ---- component --------------------------------------------------------------

export function VenueSlotTimeline({
  venueId,
  operatingHours,
  sports,
  pricePerHour,
}: {
  venueId: string
  operatingHours?: OperatingHours
  sports?: string[]
  pricePerHour?: number
}) {
  const { t, lang } = useT()
  const { isAdmin, isOwner } = useRole()
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [manualOpen, setManualOpen] = useState(false)
  const [manualPreset, setManualPreset] = useState<{ startMin: number } | null>(null)

  const now = new Date()
  const iso = toISODate(selectedDate)
  const todayIso = toISODate(now)
  const isToday = iso === todayIso
  const isPastDate = iso < todayIso
  const weekdayIdx = selectedDate.getDay()

  const { data, isLoading } = useQuery({
    queryKey: ["venue-slots", venueId, iso],
    queryFn: () =>
      getBookings({ venue_id: venueId, from: iso, to: iso, page: 1, limit: 100 }),
    enabled: !!venueId,
  })
  const bookings: Booking[] = data?.data ?? []

  const { cells, startHour, endHour } = useMemo(
    () => buildHourCells({ operatingHours, weekdayIdx, bookings, now, isToday, isPastDate }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operatingHours, weekdayIdx, bookings, iso]
  )

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const isClosed = cells.length === 0
  const canManage = isAdmin || isOwner
  const canSeeNames = isAdmin || isOwner

  const locale = lang === "ar" ? "ar-JO" : "en-GB"

  // Day label
  const displayDate = new Date(iso + "T00:00:00")
  const dayOffsetDays = Math.round(
    (displayDate.getTime() - new Date(todayIso + "T00:00:00").getTime()) / 86400000
  )
  const dayLabel = (() => {
    if (dayOffsetDays === 0) return t("today")
    if (dayOffsetDays === 1) return t("tomorrow") ?? "Tomorrow"
    if (dayOffsetDays === -1) return t("yesterday") ?? "Yesterday"
    return displayDate.toLocaleDateString(locale, { weekday: "long" })
  })()
  const dateMono = displayDate.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

  // Stats for the day
  const bookedCount = cells.filter((c) => c.state === "booked").length
  const spannedCount = cells.filter((c) => c.state === "spanned").length
  const totalBooked = bookedCount + spannedCount
  const openCount = cells.filter((c) => c.state === "open").length
  const utilization = cells.length ? Math.round((totalBooked / cells.length) * 100) : 0
  const uniqueBookings = bookedCount
  const dayRevenue = bookings.reduce(
    (acc, b) => acc + (b.totalAmount ?? b.amount ?? 0),
    0
  )

  function go(delta: number) {
    setSelectedDate((d) => addDays(d, delta))
  }

  function onDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    if (!v) return
    const [y, m, d] = v.split("-").map(Number)
    setSelectedDate(new Date(y, m - 1, d))
  }

  function openManualFor(startMin: number) {
    setManualPreset({ startMin })
    setManualOpen(true)
  }

  return (
    <div className="space-y-3.5">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-[20px] font-semibold tracking-[-0.02em] text-ink leading-none">
            {t("slot_timeline") ?? "Slot Timeline"}
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {t("slot_timeline_subtitle") ?? "Live availability grid for this court"}
          </p>
        </div>
      </div>

      {/* Controls card: date stepper + legend */}
      <div className="flex flex-wrap items-center gap-3.5 rounded-2xl bg-card p-3.5 shadow-stadium-sm">
        {/* Date stepper */}
        <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t("previous_day")}
            className="rounded-md p-1.5 text-ink-2 transition-colors hover:bg-card"
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl-flip" />
          </button>
          <div className="min-w-[160px] px-3 text-center">
            <div className="text-[13px] font-semibold text-ink leading-tight">
              {dayLabel}
            </div>
            <div className="mono text-[10px] text-ink-3">{dateMono}</div>
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t("next_day")}
            className="rounded-md p-1.5 text-ink-2 transition-colors hover:bg-card"
          >
            <ChevronRight className="h-3.5 w-3.5 rtl-flip" />
          </button>
        </div>

        {/* Jump to date input */}
        <input
          type="date"
          value={iso}
          onChange={onDateInput}
          className="mono h-8 rounded-md border border-line bg-card px-2 text-[11px] text-ink focus:border-primary focus:outline-none"
          aria-label="Jump to date"
        />

        {!isToday && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSelectedDate(new Date())}
          >
            {t("today")}
          </Button>
        )}

        {canManage && (
          <Button
            size="sm"
            className="h-8 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setManualPreset(null)
              setManualOpen(true)
            }}
            disabled={isPastDate || isClosed}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("add_manual_booking") ?? "Add booking"}
          </Button>
        )}

        {/* Push legend to end */}
        <div className="flex-1" />

        {/* Legend — inline on the right */}
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-ink-2">
          <LegendSwatch variant="open" label={t("open")} />
          <LegendSwatch variant="booked" label={t("booked")} />
          <LegendSwatch
            variant="pending"
            label={t("pending_review") ?? "Pending"}
          />
          <LegendSwatch variant="past" label={t("past")} />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="shim h-[104px] w-full rounded-2xl" />
      )}

      {/* Closed */}
      {!isLoading && isClosed && (
        <div className="rounded-2xl bg-card p-10 text-center shadow-stadium-sm">
          <p className="text-sm text-ink-2">{t("venue_closed_day")}</p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isClosed && (
        <div className="rounded-2xl bg-card p-4 shadow-stadium-sm">
          {/* Desktop grid */}
          <div className="hidden overflow-x-auto md:block">
            <div
              className="grid min-w-[900px] gap-1"
              style={{
                gridTemplateColumns: `100px repeat(${hours.length}, minmax(56px, 1fr))`,
              }}
            >
              {/* Header row: empty + hour labels */}
              <div />
              {hours.map((h) => (
                <div
                  key={h}
                  className="mono pb-2 text-center text-[10px] font-semibold text-ink-3"
                >
                  {String(h % 24).padStart(2, "0")}:00
                </div>
              ))}

              {/* Court 1 row */}
              <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-2">
                <div className="mono flex h-6 w-6 items-center justify-center rounded-md bg-surface-2 text-[10px] text-ink-2">
                  1
                </div>
                {t("court") ?? "Court"} 1
              </div>
              {cells.map((c, i) => {
                if (c.state === "spanned") return null
                return (
                  <TimelineCell
                    key={`${c.startMin}-${i}`}
                    cell={c}
                    canSeeNames={canSeeNames}
                    canManage={canManage}
                    venueId={venueId}
                    onOpenManual={openManualFor}
                    onGoToBookings={() =>
                      navigate(
                        `/bookings?venue=${venueId}&from=${iso}&to=${iso}`
                      )
                    }
                    t={t}
                  />
                )
              })}
            </div>

            {/* Now indicator overlay */}
            {isToday && <NowLine startHour={startHour} endHour={endHour} now={now} />}
          </div>

          {/* Mobile list */}
          <ul className="md:hidden divide-y divide-line/50">
            {cells.map((c, i) => {
              if (c.state === "spanned") return null
              const hourStart = c.startMin
              const hourEnd = c.startMin + (c.span ?? 1) * 60
              const label = `${formatMinutes(hourStart)} — ${formatMinutes(hourEnd)}`
              if (c.state === "booked" && c.booking) {
                return (
                  <BookingPopover
                    key={i}
                    booking={c.booking}
                    startMin={hourStart}
                    endMin={hourEnd}
                    canSeeNames={canSeeNames}
                    venueId={venueId}
                    onGoToBookings={() =>
                      navigate(`/bookings?venue=${venueId}&from=${iso}&to=${iso}`)
                    }
                  >
                    <li className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 hover:bg-primary/5">
                      <span className="mono text-[11px] text-ink-2">{label}</span>
                      <span className="flex items-center gap-2 text-sm font-medium text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                        {canSeeNames ? c.booking.player.name : t("booked")}
                      </span>
                    </li>
                  </BookingPopover>
                )
              }
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2.5",
                    c.state === "past" && "opacity-60",
                    c.state === "open" && canManage && "cursor-pointer hover:bg-primary/5"
                  )}
                  onClick={() => {
                    if (c.state === "open" && canManage) openManualFor(c.startMin)
                  }}
                >
                  <span className="mono text-[11px] text-ink-2">{label}</span>
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      c.state === "past" && "text-ink-3",
                      c.state === "open" && "text-primary"
                    )}
                  >
                    {c.state === "past" ? t("past") : t("open")}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Summary strip */}
      {!isLoading && !isClosed && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard
            icon={<BarChart3 className="h-4 w-4" />}
            label={t("utilization") ?? "Utilization"}
            value={`${utilization}%`}
            tone="brand"
          />
          <SummaryCard
            icon={<Plus className="h-4 w-4" />}
            label={t("open_slots") ?? "Open slots"}
            value={openCount}
            tone="brand"
          />
          <SummaryCard
            icon={<CalendarCheck className="h-4 w-4" />}
            label={t("bookings") ?? "Bookings"}
            value={uniqueBookings}
            tone="brand"
          />
          <SummaryCard
            icon={<Coins className="h-4 w-4" />}
            label={t("day_revenue") ?? "Day revenue"}
            value={formatCurrency(dayRevenue)}
            tone="brand"
          />
        </div>
      )}

      {/* Manual booking dialog */}
      {manualOpen && (
        <ManualBookingDialog
          venueId={venueId}
          date={iso}
          preset={manualPreset}
          sports={sports}
          pricePerHour={pricePerHour}
          cells={cells}
          onClose={() => setManualOpen(false)}
        />
      )}
    </div>
  )
}

// ---- timeline cell ---------------------------------------------------------

function TimelineCell({
  cell,
  canSeeNames,
  canManage,
  venueId,
  onOpenManual,
  onGoToBookings,
  t,
}: {
  cell: HourCell
  canSeeNames: boolean
  canManage: boolean
  venueId: string
  onOpenManual: (startMin: number) => void
  onGoToBookings: () => void
  t: (key: TranslationKey) => string
}) {
  const span = cell.span ?? 1
  // Extended frame values (e.g. 25) render as wall-clock hours (01)
  const h = Math.floor(cell.startMin / 60) % 24
  const hourLabel = `${String(h).padStart(2, "0")}:00`

  if (cell.state === "booked" && cell.booking) {
    const isPending = cell.pendingReview
    const className = cn(
      "h-11 rounded-md px-2 flex items-center gap-1.5 text-[11px] font-semibold overflow-hidden w-full cursor-pointer transition-transform hover:scale-[1.01]",
      isPending
        ? "bg-amber-tint text-amber-ink"
        : "bg-primary text-primary-foreground"
    )
    const endHour = ((cell.startMin + span * 60) / 60) % 24
    return (
      <div style={{ gridColumn: `span ${span}` }}>
        <BookingPopover
          booking={cell.booking}
          startMin={cell.startMin}
          endMin={cell.startMin + span * 60}
          canSeeNames={canSeeNames}
          venueId={venueId}
          onGoToBookings={onGoToBookings}
        >
          <button type="button" className={className}>
            {!isPending && (
              <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-lime shadow-[0_0_6px_hsl(var(--lime))]" />
            )}
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate">
                {canSeeNames ? cell.booking.player.name : t("booked")}
              </div>
              {span === 2 && (
                <div className="mono text-[9px] font-medium opacity-85">
                  {String(h).padStart(2, "0")}:00–{String(endHour).padStart(2, "0")}:00
                </div>
              )}
            </div>
            {isPending && (
              <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-amber" />
            )}
          </button>
        </BookingPopover>
      </div>
    )
  }

  if (cell.state === "open") {
    const cls = cn(
      "h-11 rounded-md flex items-center justify-center text-[14px] opacity-50 border border-dashed border-line-strong bg-card text-ink-3",
      canManage && "cursor-pointer hover:border-primary/60 hover:bg-primary/5 hover:text-primary hover:opacity-100"
    )
    return (
      <button
        type="button"
        className={cls}
        onClick={canManage ? () => onOpenManual(cell.startMin) : undefined}
        aria-label={`Open ${hourLabel}`}
        disabled={!canManage}
      >
        +
      </button>
    )
  }

  // past / blocked
  return (
    <div
      className="h-11 rounded-md bg-surface-3 text-ink-3 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.06)_4px,rgba(0,0,0,0.06)_5px)]"
      aria-label="Past"
    />
  )
}

// ---- sub-components ---------------------------------------------------------

function LegendSwatch({
  variant,
  label,
}: {
  variant: "open" | "booked" | "pending" | "past"
  label: string
}) {
  const cls = cn(
    "inline-block h-3 w-3 rounded-[3px] border",
    variant === "open" && "border-dashed border-line-strong bg-card",
    variant === "booked" && "border-transparent bg-primary",
    variant === "pending" && "border-transparent bg-amber-tint",
    variant === "past" &&
      "border-transparent bg-surface-3 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,0.1)_3px,rgba(0,0,0,0.1)_4px)]"
  )
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cls} />
      <span>{label}</span>
    </span>
  )
}

function NowLine({
  startHour,
  endHour,
  now,
}: {
  startHour: number
  endHour: number
  now: Date
}) {
  const rawNowMin = now.getHours() * 60 + now.getMinutes()
  const startMin = startHour * 60
  const endMin = endHour * 60
  // When the grid spans past midnight, lift nowMin into the extended frame.
  const isOvernight = endMin > 24 * 60
  const nowMin = isOvernight && rawNowMin < startMin ? rawNowMin + 24 * 60 : rawNowMin
  if (nowMin < startMin || nowMin > endMin) return null
  // The grid starts with a 100px first column (court label), rest is hours.
  // Position line relative to the hours area.
  const labelColPx = 100
  const pct = ((nowMin - startMin) / (endMin - startMin)) * 100
  return (
    <div
      className="pointer-events-none relative -mt-[44px] h-11"
      aria-hidden
      style={{ paddingInlineStart: labelColPx + 4 }}
    >
      <div className="relative h-full w-[calc(100%-100px-4px)]">
        <div
          className="absolute -top-1 bottom-0 w-[2px] bg-rose"
          style={{ insetInlineStart: `${pct}%` }}
        >
          <div className="absolute -top-1.5 -left-[5px] h-3 w-3 rounded-full bg-rose ring-2 ring-card" />
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  tone = "brand",
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  tone?: "brand" | "amber" | "rose" | "indigo"
}) {
  const toneCls = {
    brand: "bg-brand-tint text-brand-ink",
    amber: "bg-amber-tint text-amber-ink",
    rose: "bg-rose-tint text-rose-ink",
    indigo: "bg-indigo-tint text-indigo-ink",
  }[tone]
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-stadium-sm">
      <div
        className={cn(
          "flex h-9 w-9 flex-none items-center justify-center rounded-lg",
          toneCls
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          {label}
        </div>
        <div className="display num text-[20px] font-semibold leading-tight text-ink">
          {value}
        </div>
      </div>
    </div>
  )
}

function BookingPopover({
  booking,
  startMin,
  endMin,
  canSeeNames,
  onGoToBookings,
  children,
}: {
  booking: Booking
  startMin: number
  endMin: number
  canSeeNames: boolean
  venueId: string
  onGoToBookings: () => void
  children: React.ReactNode
}) {
  const { t } = useT()
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 p-4" align="center">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">
              {canSeeNames ? booking.player.name : t("booked")}
            </p>
            <p className="mono text-[11px] text-ink-3">
              {formatMinutes(startMin)} — {formatMinutes(endMin)}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>
        <div className="hair" />
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-ink-3">{t("sport")}</dt>
            <dd className="font-medium capitalize text-ink">{booking.sport}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-3">{t("amount")}</dt>
            <dd className="num mono font-semibold text-ink">
              {formatCurrency(booking.totalAmount ?? booking.amount)}
            </dd>
          </div>
          {booking.paymentMethod && (
            <div className="flex justify-between">
              <dt className="text-ink-3">{t("payment_method")}</dt>
              <dd className="font-medium uppercase text-ink">
                {booking.paymentMethod}
              </dd>
            </div>
          )}
        </dl>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onGoToBookings}
        >
          {t("view_in_bookings")}
          <ArrowRight className="h-3.5 w-3.5 ms-1.5 rtl-flip" />
        </Button>
      </PopoverContent>
    </Popover>
  )
}

// ---- Manual booking dialog --------------------------------------------------

function ManualBookingDialog({
  venueId,
  date,
  preset,
  sports,
  pricePerHour,
  cells,
  onClose,
}: {
  venueId: string
  date: string
  preset: { startMin: number } | null
  sports?: string[]
  pricePerHour?: number
  cells: HourCell[]
  onClose: () => void
}) {
  const { t } = useT()
  const qc = useQueryClient()

  const openStarts = cells
    .filter((c) => c.state === "open")
    .map((c) => c.startMin)

  const [startMin, setStartMin] = useState<number>(
    preset?.startMin ?? openStarts[0] ?? 9 * 60
  )
  const [duration, setDuration] = useState<number>(60)
  const [sport, setSport] = useState<string>(sports?.[0] ?? "football")
  const [playerName, setPlayerName] = useState("")
  const [notes, setNotes] = useState("")

  const amount = pricePerHour ? (pricePerHour * duration) / 60 : null

  const create = useMutation({
    mutationFn: async () => {
      // Normalize startMin into 0-24h before serializing — the cell list
      // may contain extended-frame values (e.g. 25:00 = 01:00 next day).
      const normalizedStart = ((startMin % (24 * 60)) + 24 * 60) % (24 * 60)
      const res = await api.post("/bookings", {
        venueId,
        sport,
        date,
        startTime: `${String(Math.floor(normalizedStart / 60)).padStart(2, "0")}:${String(normalizedStart % 60).padStart(2, "0")}`,
        duration,
        paymentMethod: "cliq",
        notes: `[MANUAL] ${playerName ? `Walk-in: ${playerName}. ` : ""}${notes}`.trim(),
      })
      return res.data
    },
    onSuccess: () => {
      toast.success(t("manual_booking_created") ?? "Manual booking created")
      qc.invalidateQueries({ queryKey: ["venue-slots", venueId] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      onClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(
        e.response?.data?.message ?? t("manual_booking_failed") ?? "Failed to create booking"
      )
    },
  })

  const handleSubmit = () => {
    if (openStarts.length === 0) {
      toast.error(t("no_open_slots") ?? "No open slots available")
      return
    }
    create.mutate()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-lg font-semibold tracking-tight">
            {t("add_manual_booking") ?? "Add manual booking"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-ink-3">
            {t("manual_booking_hint") ??
              "Block a slot for a walk-in player or in-person booking. The booking is logged under your account."}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label={t("start_time") ?? "Start"}>
              <select
                value={startMin}
                onChange={(e) => setStartMin(Number(e.target.value))}
                className="mono h-9 w-full rounded-md border border-line bg-card px-2 text-sm text-ink focus:border-primary focus:outline-none"
              >
                {openStarts.length === 0 && <option value={startMin}>—</option>}
                {openStarts.map((m) => (
                  <option key={m} value={m}>
                    {formatHour(m)}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label={t("duration") ?? "Duration"}>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mono h-9 w-full rounded-md border border-line bg-card px-2 text-sm text-ink focus:border-primary focus:outline-none"
              >
                <option value={30}>30 min</option>
                <option value={60}>1 h</option>
                <option value={90}>1 h 30</option>
                <option value={120}>2 h</option>
              </select>
            </FieldLabel>
          </div>

          <FieldLabel label={t("sport") ?? "Sport"}>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-card px-2 text-sm capitalize text-ink focus:border-primary focus:outline-none"
            >
              {(sports && sports.length > 0
                ? sports
                : ["football", "basketball", "tennis", "padel", "volleyball"]
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FieldLabel>

          <FieldLabel label={t("player_name") ?? "Walk-in player (optional)"}>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={t("player_name_placeholder") ?? "Faris Odeh"}
              className="h-9 w-full rounded-md border border-line bg-card px-2 text-sm text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
            />
          </FieldLabel>

          <FieldLabel label={t("notes") ?? "Notes"}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t("notes_placeholder") ?? "Paid cash at venue…"}
              className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
            />
          </FieldLabel>

          {amount != null && (
            <div className="flex items-center justify-between rounded-lg bg-brand-tint px-3 py-2 text-sm">
              <span className="text-brand-ink">
                {t("estimated_amount") ?? "Estimated"}
              </span>
              <span className="num mono font-semibold text-brand-ink">
                {formatCurrency(amount)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            {t("cancel") ?? "Cancel"}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={create.isPending || openStarts.length === 0}
            className="gap-1"
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            {t("create_booking") ?? "Create booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldLabel({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        {label}
      </span>
      {children}
    </label>
  )
}
