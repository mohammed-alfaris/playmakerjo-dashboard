import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Plus,
  Clock,
  Coins,
  ArrowRight,
  MapPin,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { StatusBadge } from "@/components/shared/StatusBadge"
import { getVenues, type Venue } from "@/api/venues"
import { getBookings, type Booking } from "@/api/bookings"
import { useRole, useOwnerFilter } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { formatCurrency } from "@/lib/formatters"
import type { OperatingHours, DayHours } from "@/lib/types"

// Number of courts to render per venue. Venues only have one court today —
// bump this (or make it data-driven) when the backend adds a `courts` field.
const COURTS_PER_VENUE = 1

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

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const suffix = h >= 12 ? "PM" : "AM"
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`
}

function formatHour(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// ---- grid types -------------------------------------------------------------

/** The timeline grid is measured in 30-minute slots. */
const SLOT_MIN = 30

type SlotState =
  | "open"
  | "booked"
  | "pending"
  | "pending_payment"
  | "pending_review"
  | "completed"
  | "no_show"
  | "cancelled"
  | "blocked"
  | "spanned"

/** States that represent a "hold" (awaiting something) — used for summary counts. */
const HOLD_STATES: SlotState[] = ["pending", "pending_payment", "pending_review"]

interface HourCell {
  /** Slot start offset in minutes from midnight (multiples of SLOT_MIN) */
  startMin: number
  state: SlotState
  /** Number of SLOT_MIN cells this booking spans (1 = 30 min, 2 = 1 h, 3 = 1 h 30, 4 = 2 h) */
  span?: number
  booking?: Booking
}

/**
 * Build one row's cells for a given court. Bookings are pre-assigned to courts.
 * Each cell represents one SLOT_MIN (30-minute) bucket.
 */
function buildCourtRow({
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
  const startHour = Math.floor(start / 60)
  const endCapped = end <= start ? 24 * 60 : end
  const endHour = Math.ceil(endCapped / 60)

  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1
  const cells: HourCell[] = []

  // Iterate every SLOT_MIN bucket between startHour and endHour
  const firstSlot = startHour * 60
  const lastSlot = endHour * 60
  for (let slotStart = firstSlot; slotStart < lastSlot; slotStart += SLOT_MIN) {
    const slotEnd = slotStart + SLOT_MIN
    let state: SlotState = "open"
    if (isPastDate) state = "blocked"
    else if (isToday && slotEnd <= nowMin) state = "blocked"

    let booking: Booking | undefined
    for (const b of bookings) {
      const bStart = parseTime(b.startTime)
      if (bStart == null) continue
      const bEnd = bStart + (b.duration ?? 0)
      if (slotStart < bEnd && slotEnd > bStart) {
        booking = b
        switch (b.status) {
          case "pending":
            state = "pending"
            break
          case "pending_payment":
            state = "pending_payment"
            break
          case "pending_review":
            state = "pending_review"
            break
          case "completed":
            state = "completed"
            break
          case "no_show":
            state = "no_show"
            break
          case "cancelled":
            state = "cancelled"
            break
          case "confirmed":
          default:
            // Proof awaiting review can also live on a confirmed booking
            state =
              b.paymentProofStatus === "pending_review"
                ? "pending_review"
                : "booked"
            break
        }
        break
      }
    }
    cells.push({ startMin: slotStart, state, booking })
  }

  // Collapse consecutive cells belonging to the same booking id
  const CELL_STATES_TO_COLLAPSE: SlotState[] = [
    "booked",
    "pending",
    "pending_payment",
    "pending_review",
    "completed",
    "no_show",
    "cancelled",
  ]
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    if (!CELL_STATES_TO_COLLAPSE.includes(c.state) || !c.booking) continue
    let span = 1
    for (let j = i + 1; j < cells.length; j++) {
      if (
        CELL_STATES_TO_COLLAPSE.includes(cells[j].state) &&
        cells[j].booking?.id === c.booking.id
      ) {
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

/** Greedy first-fit: assign each booking to the first court with no overlap. */
function distributeBookingsToCourts(
  bookings: Booking[],
  numCourts: number
): Booking[][] {
  const courts: Booking[][] = Array.from({ length: numCourts }, () => [])
  const sorted = [...bookings].sort((a, b) => {
    const sa = parseTime(a.startTime) ?? 0
    const sb = parseTime(b.startTime) ?? 0
    return sa - sb
  })
  for (const b of sorted) {
    const bStart = parseTime(b.startTime)
    if (bStart == null) continue
    const bEnd = bStart + (b.duration ?? 0)
    let placed = false
    for (let i = 0; i < numCourts; i++) {
      const overlap = courts[i].some((x) => {
        const xs = parseTime(x.startTime) ?? 0
        const xe = xs + (x.duration ?? 0)
        return bStart < xe && bEnd > xs
      })
      if (!overlap) {
        courts[i].push(b)
        placed = true
        break
      }
    }
    if (!placed) courts[0].push(b) // overflow into court 1
  }
  return courts
}

// ---- page -------------------------------------------------------------------

export default function TimelinePage() {
  const { t, lang } = useT()
  const ownerFilter = useOwnerFilter()
  const { isAdmin, isOwner } = useRole()
  const canManage = isAdmin || isOwner
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [selectedId, setSelectedId] = useState<string>("")
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignPreset, setAssignPreset] = useState<{
    startMin?: number
    courtIndex?: number
  } | null>(null)

  const { data: venuesData, isLoading: venuesLoading } = useQuery({
    queryKey: ["timeline-venues", ownerFilter],
    queryFn: () => getVenues({ page: 1, limit: 100, ...ownerFilter }),
  })
  const venues: Venue[] = useMemo(() => venuesData?.data ?? [], [venuesData])

  const effectiveId =
    (selectedId && venues.some((v) => v.id === selectedId)
      ? selectedId
      : venues[0]?.id) ?? ""
  const selectedVenue = venues.find((v) => v.id === effectiveId)

  const now = new Date()
  const iso = toISODate(selectedDate)
  const todayIso = toISODate(now)
  const isToday = iso === todayIso
  const isPastDate = iso < todayIso
  const weekdayIdx = selectedDate.getDay()

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ["timeline-bookings", effectiveId, iso],
    queryFn: () =>
      getBookings({ venue_id: effectiveId, from: iso, to: iso, page: 1, limit: 100 }),
    enabled: !!effectiveId,
  })
  const bookings: Booking[] = useMemo(
    () => bookingsData?.data ?? [],
    [bookingsData]
  )

  // Distribute bookings into N courts
  const courtsBookings = useMemo(
    () => distributeBookingsToCourts(bookings, COURTS_PER_VENUE),
    [bookings]
  )

  // Build one row per court
  const courtRows = useMemo(() => {
    return courtsBookings.map((bs) =>
      buildCourtRow({
        operatingHours: selectedVenue?.operatingHours,
        weekdayIdx,
        bookings: bs,
        now,
        isToday,
        isPastDate,
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtsBookings, selectedVenue?.operatingHours, weekdayIdx, iso])

  const firstRow = courtRows[0]
  const startHour = firstRow?.startHour ?? 0
  const endHour = firstRow?.endHour ?? 0
  const hours = Array.from({ length: Math.max(0, endHour - startHour) }, (_, i) => startHour + i)
  const isClosed = hours.length === 0

  const locale = lang === "ar" ? "ar-JO" : "en-GB"
  const displayDate = new Date(iso + "T00:00:00")
  const dayOffsetDays = Math.round(
    (displayDate.getTime() - new Date(todayIso + "T00:00:00").getTime()) / 86400000
  )
  const dayLabel = (() => {
    if (dayOffsetDays === 0) return t("today")
    if (dayOffsetDays === 1) return t("tomorrow")
    if (dayOffsetDays === -1) return t("yesterday")
    return displayDate.toLocaleDateString(locale, { weekday: "long" })
  })()
  const dateMono = displayDate.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

  // Summary counts — aggregated across courts
  let bookedCells = 0
  let holdCells = 0
  let completedCells = 0
  let openCells = 0
  let totalCells = 0
  for (const row of courtRows) {
    for (const c of row.cells) {
      totalCells++
      if (c.state === "booked") bookedCells += c.span ?? 1
      else if (HOLD_STATES.includes(c.state)) holdCells += c.span ?? 1
      else if (c.state === "completed") completedCells += c.span ?? 1
      else if (c.state === "open") openCells++
    }
  }
  // Utilization counts anything the slot-is-in-use: booked + hold + completed
  const utilization = totalCells
    ? Math.round(((bookedCells + holdCells + completedCells) / totalCells) * 100)
    : 0
  const dayRevenue = bookings.reduce(
    (acc, b) => acc + (b.totalAmount ?? b.amount ?? 0),
    0
  )

  function goDay(delta: number) {
    setSelectedDate((d) => addDays(d, delta))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="display text-2xl font-semibold tracking-tight text-ink">
          {t("slot_timeline")}
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          {t("timeline_subtitle_all_courts")}
        </p>
      </div>

      {/* Controls bar: venue select + date stepper + legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3.5 shadow-stadium-sm">
        {/* Venue select */}
        <Select
          value={effectiveId || undefined}
          onValueChange={(v) => setSelectedId(v)}
          disabled={venuesLoading || venues.length === 0}
        >
          <SelectTrigger className="h-9 min-w-[200px] rounded-lg border-0 bg-surface-2 text-sm font-semibold text-ink focus:ring-1 focus:ring-primary">
            <SelectValue placeholder={t("select_venue")} />
          </SelectTrigger>
          <SelectContent>
            {venues.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-ink-3">
                {t("no_venues_available")}
              </div>
            )}
            {venues.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date stepper */}
        <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => goDay(-1)}
            aria-label={t("previous_day")}
            className="rounded-md p-1.5 text-ink-2 transition-colors hover:bg-card"
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl-flip" />
          </button>
          <div className="min-w-[150px] px-3 text-center">
            <div className="text-[13px] font-semibold leading-tight text-ink">
              {dayLabel}
            </div>
            <div className="mono text-[10px] text-ink-3">{dateMono}</div>
          </div>
          <button
            type="button"
            onClick={() => goDay(1)}
            aria-label={t("next_day")}
            className="rounded-md p-1.5 text-ink-2 transition-colors hover:bg-card"
          >
            <ChevronRight className="h-3.5 w-3.5 rtl-flip" />
          </button>
        </div>

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

        {canManage && selectedVenue && (
          <Button
            size="sm"
            className="h-8 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setAssignPreset(null)
              setAssignOpen(true)
            }}
            disabled={isPastDate || isClosed}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("add_manual_booking")}
          </Button>
        )}

        <div className="flex-1" />

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-ink-2">
          <LegendSwatch variant="open" label={t("open")} />
          <LegendSwatch variant="booked" label={t("status_confirmed")} />
          <LegendSwatch variant="pending" label={t("status_pending")} />
          <LegendSwatch variant="pending_payment" label={t("status_pending_payment")} />
          <LegendSwatch variant="pending_review" label={t("status_pending_review")} />
          <LegendSwatch variant="completed" label={t("status_completed")} />
          <LegendSwatch variant="no_show" label={t("status_no_show")} />
          <LegendSwatch variant="cancelled" label={t("status_cancelled")} />
          <LegendSwatch variant="blocked" label={t("blocked")} />
        </div>
      </div>

      {/* Loading */}
      {(venuesLoading || bookingsLoading) && (
        <div className="shim h-[240px] w-full rounded-2xl" />
      )}

      {/* Empty venues */}
      {!venuesLoading && venues.length === 0 && (
        <div className="rounded-2xl bg-card p-10 text-center shadow-stadium-sm">
          <MapPin className="mx-auto mb-2 h-6 w-6 text-ink-3" />
          <p className="text-sm text-ink-2">{t("no_venues_available")}</p>
        </div>
      )}

      {/* Closed venue for the day */}
      {!bookingsLoading && selectedVenue && isClosed && (
        <div className="rounded-2xl bg-card p-10 text-center shadow-stadium-sm">
          <p className="text-sm text-ink-2">{t("venue_closed_day")}</p>
        </div>
      )}

      {/* Grid */}
      {!bookingsLoading && selectedVenue && !isClosed && (
        <div className="rounded-2xl bg-card p-4 shadow-stadium-sm">
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[1000px] gap-1"
              style={{
                // Two 30-min columns per hour
                gridTemplateColumns: `repeat(${hours.length * 2}, minmax(34px, 1fr))`,
              }}
            >
              {/* Hour header row — each label spans 2 slot columns */}
              {hours.map((h) => (
                <div
                  key={h}
                  className="mono pb-2 text-center text-[10px] font-semibold text-ink-3"
                  style={{ gridColumn: "span 2" }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}

              {/* One row per court */}
              {courtRows.map((row, courtIdx) => (
                <CourtRowCells
                  key={courtIdx}
                  cells={row.cells}
                  canManage={canManage}
                  t={t}
                  onOpenManual={(startMin) => {
                    setAssignPreset({ startMin, courtIndex: courtIdx })
                    setAssignOpen(true)
                  }}
                  onGoToBookings={() =>
                    navigate(
                      `/bookings?venue=${effectiveId}&from=${iso}&to=${iso}`
                    )
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary strip */}
      {!bookingsLoading && selectedVenue && !isClosed && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard
            icon={<BarChart3 className="h-4 w-4" />}
            label={t("utilization")}
            value={`${utilization}%`}
            tone="brand"
          />
          <SummaryCard
            icon={<Plus className="h-4 w-4" />}
            label={t("open_slots")}
            value={openCells}
            tone="brand"
          />
          <SummaryCard
            icon={<Clock className="h-4 w-4" />}
            label={t("holds")}
            value={holdCells}
            tone="amber"
          />
          <SummaryCard
            icon={<Coins className="h-4 w-4" />}
            label={t("day_revenue")}
            value={formatCurrency(dayRevenue)}
            tone="brand"
          />
        </div>
      )}

      {/* Assign booking dialog */}
      {assignOpen && selectedVenue && (
        <AssignBookingDialog
          venueId={selectedVenue.id}
          date={iso}
          preset={assignPreset}
          sports={selectedVenue.sports}
          pricePerHour={selectedVenue.pricePerHour}
          courtRows={courtRows}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </div>
  )
}

// ---- court row --------------------------------------------------------------

function CourtRowCells({
  cells,
  canManage,
  t,
  onOpenManual,
  onGoToBookings,
}: {
  cells: HourCell[]
  canManage: boolean
  t: (k: TranslationKey) => string
  onOpenManual: (startMin: number) => void
  onGoToBookings: () => void
}) {
  return (
    <>
      {cells.map((c, i) => {
        if (c.state === "spanned") return null
        return (
          <TimelineCell
            key={`${c.startMin}-${i}`}
            cell={c}
            canManage={canManage}
            t={t}
            onOpenManual={onOpenManual}
            onGoToBookings={onGoToBookings}
          />
        )
      })}
    </>
  )
}

// ---- timeline cell ----------------------------------------------------------

function TimelineCell({
  cell,
  canManage,
  t,
  onOpenManual,
  onGoToBookings,
}: {
  cell: HourCell
  canManage: boolean
  t: (k: TranslationKey) => string
  onOpenManual: (startMin: number) => void
  onGoToBookings: () => void
}) {
  const span = cell.span ?? 1
  const startMin = cell.startMin
  const endMin = startMin + span * SLOT_MIN
  const hourLabel = formatHour(startMin)
  const rangeLabel = `${formatHour(startMin)}–${formatHour(endMin)}`

  // BOOKED (green)
  if (cell.state === "booked" && cell.booking) {
    return (
      <div style={{ gridColumn: `span ${span}` }}>
        <BookingPopover
          booking={cell.booking}
          startMin={startMin}
          endMin={endMin}
          onGoToBookings={onGoToBookings}
        >
          <button
            type="button"
            className="flex h-11 w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
          >
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-lime shadow-[0_0_6px_hsl(var(--lime))]" />
            <div className="min-w-0 flex-1 overflow-hidden text-start">
              <div className="truncate">{cell.booking.player.name}</div>
              {span >= 3 && (
                <div className="mono text-[9px] font-medium opacity-85">
                  {rangeLabel}
                </div>
              )}
            </div>
          </button>
        </BookingPopover>
      </div>
    )
  }

  // PENDING (amber) — awaiting general confirmation
  if (cell.state === "pending" && cell.booking) {
    return (
      <div style={{ gridColumn: `span ${span}` }}>
        <BookingPopover
          booking={cell.booking}
          startMin={startMin}
          endMin={endMin}
          onGoToBookings={onGoToBookings}
        >
          <button
            type="button"
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md bg-amber-tint px-2 text-[11px] font-semibold text-amber-ink transition-transform hover:scale-[1.01]"
          >
            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-amber" />
            <span className="truncate">{t("status_pending")}</span>
          </button>
        </BookingPopover>
      </div>
    )
  }

  // PENDING_PAYMENT (sky) — waiting for money
  if (cell.state === "pending_payment" && cell.booking) {
    return (
      <div style={{ gridColumn: `span ${span}` }}>
        <BookingPopover
          booking={cell.booking}
          startMin={startMin}
          endMin={endMin}
          onGoToBookings={onGoToBookings}
        >
          <button
            type="button"
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md bg-sky-tint px-2 text-[11px] font-semibold text-sky-ink transition-transform hover:scale-[1.01]"
          >
            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-sky" />
            <span className="truncate">{t("status_pending_payment")}</span>
          </button>
        </BookingPopover>
      </div>
    )
  }

  // PENDING_REVIEW (violet) — proof awaiting review
  if (cell.state === "pending_review" && cell.booking) {
    return (
      <div style={{ gridColumn: `span ${span}` }}>
        <BookingPopover
          booking={cell.booking}
          startMin={startMin}
          endMin={endMin}
          onGoToBookings={onGoToBookings}
        >
          <button
            type="button"
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md bg-violet-tint px-2 text-[11px] font-semibold text-violet-ink transition-transform hover:scale-[1.01]"
          >
            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-violet" />
            <span className="truncate">{t("status_pending_review")}</span>
          </button>
        </BookingPopover>
      </div>
    )
  }

  // COMPLETED (indigo)
  if (cell.state === "completed" && cell.booking) {
    return (
      <div style={{ gridColumn: `span ${span}` }}>
        <BookingPopover
          booking={cell.booking}
          startMin={startMin}
          endMin={endMin}
          onGoToBookings={onGoToBookings}
        >
          <button
            type="button"
            className="flex h-11 w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-md bg-indigo-tint px-2 text-[11px] font-semibold text-indigo-ink transition-transform hover:scale-[1.01]"
          >
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-indigo" />
            <div className="min-w-0 flex-1 overflow-hidden text-start">
              <div className="truncate">{cell.booking.player.name}</div>
              {span >= 3 && (
                <div className="mono text-[9px] font-medium opacity-80">
                  {t("status_completed")}
                </div>
              )}
            </div>
          </button>
        </BookingPopover>
      </div>
    )
  }

  // NO-SHOW (rose)
  if (cell.state === "no_show" && cell.booking) {
    return (
      <div style={{ gridColumn: `span ${span}` }}>
        <BookingPopover
          booking={cell.booking}
          startMin={startMin}
          endMin={endMin}
          onGoToBookings={onGoToBookings}
        >
          <button
            type="button"
            className="flex h-11 w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-md bg-rose-tint px-2 text-[11px] font-semibold text-rose-ink transition-transform hover:scale-[1.01]"
          >
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-rose" />
            <div className="min-w-0 flex-1 overflow-hidden text-start">
              <div className="truncate">{cell.booking.player.name}</div>
              {span >= 3 && (
                <div className="mono text-[9px] font-medium opacity-80">
                  {t("status_no_show")}
                </div>
              )}
            </div>
          </button>
        </BookingPopover>
      </div>
    )
  }

  // CANCELLED (slate with rose accent + strikethrough)
  if (cell.state === "cancelled" && cell.booking) {
    return (
      <div style={{ gridColumn: `span ${span}` }}>
        <BookingPopover
          booking={cell.booking}
          startMin={startMin}
          endMin={endMin}
          onGoToBookings={onGoToBookings}
        >
          <button
            type="button"
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md border border-rose/40 bg-surface-2 px-2 text-[11px] font-semibold text-rose transition-transform hover:scale-[1.01]"
          >
            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-rose opacity-70" />
            <span className="truncate line-through">
              {cell.booking.player.name}
            </span>
          </button>
        </BookingPopover>
      </div>
    )
  }

  // OPEN (dashed +)
  if (cell.state === "open") {
    const cls = cn(
      "flex h-11 items-center justify-center rounded-md border border-dashed border-line-strong bg-card text-[14px] text-ink-3 opacity-50",
      canManage &&
        "cursor-pointer transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-primary hover:opacity-100"
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

  // BLOCKED (past / closed)
  return (
    <div
      className="h-11 rounded-md bg-surface-3 text-ink-3 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.06)_4px,rgba(0,0,0,0.06)_5px)]"
      aria-label="Blocked"
    />
  )
}

// ---- sub-components ---------------------------------------------------------

type LegendVariant =
  | "open"
  | "booked"
  | "pending"
  | "pending_payment"
  | "pending_review"
  | "completed"
  | "no_show"
  | "cancelled"
  | "blocked"

function LegendSwatch({
  variant,
  label,
}: {
  variant: LegendVariant
  label: string
}) {
  const baseCls = "inline-block h-3 w-3 rounded-[3px] border"

  if (variant === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(baseCls, "border-rose/50 bg-surface-2 text-rose")}
          style={{
            backgroundImage:
              "linear-gradient(to right, transparent 38%, currentColor 38%, currentColor 62%, transparent 62%)",
          }}
        />
        <span>{label}</span>
      </span>
    )
  }

  if (variant === "blocked") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(baseCls, "border-transparent bg-surface-3 text-ink-3")}
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0, transparent 3px, currentColor 3px, currentColor 4px)",
            opacity: 0.7,
          }}
        />
        <span>{label}</span>
      </span>
    )
  }

  const cls = cn(
    baseCls,
    variant === "open" && "border-dashed border-line-strong bg-card",
    variant === "booked" && "border-transparent bg-primary",
    variant === "pending" && "border-transparent bg-amber",
    variant === "pending_payment" && "border-transparent bg-sky",
    variant === "pending_review" && "border-transparent bg-violet",
    variant === "completed" && "border-transparent bg-indigo",
    variant === "no_show" && "border-transparent bg-rose"
  )
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cls} />
      <span>{label}</span>
    </span>
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
  onGoToBookings,
  children,
}: {
  booking: Booking
  startMin: number
  endMin: number
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
            <p className="text-sm font-semibold text-ink">{booking.player.name}</p>
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
          <ArrowRight className="ms-1.5 h-3.5 w-3.5 rtl-flip" />
        </Button>
      </PopoverContent>
    </Popover>
  )
}

// ---- Assign booking dialog --------------------------------------------------

type CourtRow = {
  cells: HourCell[]
  startHour: number
  endHour: number
}

function AssignBookingDialog({
  venueId,
  date,
  preset,
  sports,
  pricePerHour,
  courtRows,
  onClose,
}: {
  venueId: string
  date: string
  preset: { startMin?: number; courtIndex?: number } | null
  sports?: string[]
  pricePerHour?: number
  courtRows: CourtRow[]
  onClose: () => void
}) {
  const { t } = useT()
  const qc = useQueryClient()

  // Default preferred court: preset's court if provided, else 0
  const initialCourt = preset?.courtIndex ?? 0
  const [courtIndex, setCourtIndex] = useState<number>(initialCourt)

  // For the selected court, compute the list of currently-open start minutes
  const openStartsForCourt = useMemo(() => {
    const row = courtRows[courtIndex]
    if (!row) return []
    return row.cells.filter((c) => c.state === "open").map((c) => c.startMin)
  }, [courtRows, courtIndex])

  const [startMin, setStartMin] = useState<number>(() => {
    const ps = preset?.startMin
    if (ps != null && openStartsForCourt.includes(ps)) return ps
    return openStartsForCourt[0] ?? 9 * 60
  })
  const [duration, setDuration] = useState<number>(60)
  const [sport, setSport] = useState<string>(sports?.[0] ?? "football")
  const [playerName, setPlayerName] = useState("")
  const [notes, setNotes] = useState("")

  const amount = pricePerHour ? (pricePerHour * duration) / 60 : null

  const create = useMutation({
    mutationFn: async () => {
      const startHH = String(Math.floor(startMin / 60)).padStart(2, "0")
      const startMM = String(startMin % 60).padStart(2, "0")
      const notePrefix = `[MANUAL] [Court ${courtIndex + 1}]`
      const walkIn = playerName ? ` Walk-in: ${playerName}.` : ""
      const extra = notes ? ` ${notes}` : ""
      const res = await api.post("/bookings", {
        venueId,
        sport,
        date,
        startTime: `${startHH}:${startMM}`,
        duration,
        paymentMethod: "cliq",
        notes: `${notePrefix}${walkIn}${extra}`.trim(),
      })
      return res.data
    },
    onSuccess: () => {
      toast.success(t("manual_booking_created"))
      qc.invalidateQueries({ queryKey: ["timeline-bookings", venueId] })
      qc.invalidateQueries({ queryKey: ["venue-slots", venueId] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      onClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? t("manual_booking_failed"))
    },
  })

  const handleSubmit = () => {
    if (openStartsForCourt.length === 0) {
      toast.error(t("no_open_slots"))
      return
    }
    create.mutate()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-lg font-semibold tracking-tight">
            {t("add_manual_booking")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-ink-3">{t("manual_booking_hint")}</p>

          {courtRows.length > 1 && (
            <FieldLabel label={t("court")}>
              <select
                value={courtIndex}
                onChange={(e) => {
                  const idx = Number(e.target.value)
                  setCourtIndex(idx)
                  // reset start to first open on new court
                  const row = courtRows[idx]
                  const firstOpen = row?.cells.find((c) => c.state === "open")
                  if (firstOpen) setStartMin(firstOpen.startMin)
                }}
                className="h-9 w-full rounded-md border border-line bg-card px-2 text-sm text-ink focus:border-primary focus:outline-none"
              >
                {courtRows.map((_, i) => (
                  <option key={i} value={i}>
                    {t("court")} {i + 1}
                  </option>
                ))}
              </select>
            </FieldLabel>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label={t("start_time")}>
              <select
                value={startMin}
                onChange={(e) => setStartMin(Number(e.target.value))}
                className="mono h-9 w-full rounded-md border border-line bg-card px-2 text-sm text-ink focus:border-primary focus:outline-none"
              >
                {openStartsForCourt.length === 0 && (
                  <option value={startMin}>—</option>
                )}
                {openStartsForCourt.map((m) => (
                  <option key={m} value={m}>
                    {formatHour(m)}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label={t("duration")}>
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

          <FieldLabel label={t("sport")}>
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

          <FieldLabel label={t("player_name")}>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={t("player_name_placeholder")}
              className="h-9 w-full rounded-md border border-line bg-card px-2 text-sm text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
            />
          </FieldLabel>

          <FieldLabel label={t("notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t("notes_placeholder")}
              className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
            />
          </FieldLabel>

          {amount != null && (
            <div className="flex items-center justify-between rounded-lg bg-brand-tint px-3 py-2 text-sm">
              <span className="text-brand-ink">{t("estimated_amount")}</span>
              <span className="num mono font-semibold text-brand-ink">
                {formatCurrency(amount)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={create.isPending || openStartsForCourt.length === 0}
            className="gap-1"
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            {t("create_booking")}
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
