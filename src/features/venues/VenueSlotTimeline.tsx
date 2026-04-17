import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight, User, ArrowRight } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getBookings, type Booking } from "@/api/bookings"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import type { OperatingHours, DayHours } from "@/lib/types"
import { StatusBadge } from "@/components/shared/StatusBadge"

// ---- helpers ----------------------------------------------------------------

/**
 * Backend returns short keys ("fri", "mon", ...) but the TS type uses long
 * names. Accept BOTH by indexing with a pair of keys per day, in this order:
 * Sunday → [sun, sunday], Monday → [mon, monday], etc.
 */
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
  // Use LOCAL date components — toISOString() shifts to UTC and can roll back
  // the date in GMT+ timezones (Jordan is GMT+3).
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

interface Slot {
  /** Start offset in minutes from midnight */
  startMin: number
  /** End offset in minutes from midnight */
  endMin: number
  status: "past" | "open" | "booked"
  booking?: Booking
}

function buildSlots({
  operatingHours,
  weekdayIdx,
  bookings,
  now,
  isToday,
  isPastDate,
  stepMin = 30,
}: {
  operatingHours?: OperatingHours
  weekdayIdx: number
  bookings: Booking[]
  now: Date
  isToday: boolean
  isPastDate: boolean
  stepMin?: number
}): Slot[] {
  const dh = resolveDay(operatingHours, weekdayIdx)
  if (!dh || dh.closed) return []
  const start = parseTime(dh.open)
  const end = parseTime(dh.close)
  if (start == null || end == null) return []
  // Overnight venues: close < open means we cap at 24:00 for simplicity (v1).
  const endCapped = end <= start ? 24 * 60 : end
  const slots: Slot[] = []

  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1

  for (let m = start; m + stepMin <= endCapped; m += stepMin) {
    const slotEnd = m + stepMin
    // Past if entire date already passed, OR today and slot ended
    let status: Slot["status"] = "open"
    let booking: Booking | undefined
    if (isPastDate) status = "past"
    else if (isToday && slotEnd <= nowMin) status = "past"

    // Check overlap against any booking
    for (const b of bookings) {
      const bStart = parseTime(b.startTime)
      if (bStart == null) continue
      const bEnd = bStart + (b.duration ?? 0)
      // Overlap: slot.start < bEnd && slot.end > b.start
      if (m < bEnd && slotEnd > bStart) {
        status = "booked"
        booking = b
        break
      }
    }
    slots.push({ startMin: m, endMin: slotEnd, status, booking })
  }
  return slots
}

/**
 * Group consecutive booked slots by the same booking id so the horizontal
 * strip renders one wider block per booking instead of N adjacent cells.
 */
function groupConsecutive(slots: Slot[]): { slots: Slot[]; span: number }[] {
  const out: { slots: Slot[]; span: number }[] = []
  let i = 0
  while (i < slots.length) {
    const cur = slots[i]
    let j = i + 1
    while (
      j < slots.length &&
      slots[j].status === cur.status &&
      slots[j].booking?.id === cur.booking?.id
    ) {
      j += 1
    }
    out.push({ slots: slots.slice(i, j), span: j - i })
    i = j
  }
  return out
}

// ---- component --------------------------------------------------------------

export function VenueSlotTimeline({
  venueId,
  operatingHours,
}: {
  venueId: string
  operatingHours?: OperatingHours
}) {
  const { t, lang } = useT()
  const { isAdmin, isOwner } = useRole()
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())

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

  const slots = useMemo(
    () => buildSlots({ operatingHours, weekdayIdx, bookings, now, isToday, isPastDate }),
    // now is re-evaluated each render; that's fine for minute-level accuracy
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operatingHours, weekdayIdx, bookings, iso]
  )

  const isClosed = !slots.length
  const canSeeNames = isAdmin || isOwner

  const stripGroups = useMemo(() => groupConsecutive(slots), [slots])

  const locale = lang === "ar" ? "ar-JO" : "en-GB"
  const dateLabel = selectedDate.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  function go(delta: number) {
    setSelectedDate((d) => addDays(d, delta))
  }

  function onDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value // "YYYY-MM-DD"
    if (!v) return
    const [y, m, d] = v.split("-").map(Number)
    setSelectedDate(new Date(y, m - 1, d))
  }

  return (
    <section className="rounded-xl bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t("todays_slots")}
          </h2>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => go(-1)}
            aria-label={t("previous_day")}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <input
            type="date"
            value={iso}
            onChange={onDateInput}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => go(1)}
            aria-label={t("next_day")}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
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
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <LegendDot className="bg-primary/15 border border-primary/30" />
        <span>{t("open")}</span>
        <LegendDot className="bg-primary" />
        <span>{t("booked")}</span>
        <LegendDot className="bg-muted" />
        <span>{t("past")}</span>
      </div>

      {isLoading && (
        <div className="h-12 animate-pulse rounded-md bg-muted/40" />
      )}

      {!isLoading && isClosed && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {t("venue_closed_day")}
        </p>
      )}

      {!isLoading && !isClosed && (
        <>
          {/* Desktop: horizontal strip (md+) */}
          <div className="hidden md:block">
            <div className="flex w-full overflow-hidden rounded-md border border-border">
              {stripGroups.map((g, i) => {
                const first = g.slots[0]
                const cellClass = cn(
                  "relative h-10 flex items-center justify-center text-[10px] font-medium border-e border-border last:border-e-0 transition-colors",
                  first.status === "past" && "bg-muted text-muted-foreground",
                  first.status === "open" && "bg-primary/10 text-primary hover:bg-primary/15",
                  first.status === "booked" && "bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                )
                const content =
                  first.status === "booked" && first.booking ? (
                    <span className="truncate px-2">
                      {canSeeNames ? first.booking.player.name : t("booked")}
                    </span>
                  ) : null
                const style = { flex: g.span }
                if (first.status === "booked" && first.booking) {
                  return (
                    <BookingPopover
                      key={`${first.startMin}-${i}`}
                      booking={first.booking}
                      startMin={first.startMin}
                      endMin={g.slots[g.slots.length - 1].endMin}
                      canSeeNames={canSeeNames}
                      venueId={venueId}
                      onGoToBookings={() =>
                        navigate(`/bookings?venue=${venueId}&from=${iso}&to=${iso}`)
                      }
                    >
                      <button type="button" className={cellClass} style={style}>
                        {content}
                      </button>
                    </BookingPopover>
                  )
                }
                return (
                  <div key={`${first.startMin}-${i}`} className={cellClass} style={style}>
                    {first.status === "past" && g.span >= 2 && (
                      <span className="opacity-60">{formatMinutes(first.startMin)}</span>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Hour axis */}
            <div className="flex mt-1 text-[10px] text-muted-foreground">
              {slots.filter((_, idx) => idx % 2 === 0).map((s) => (
                <div
                  key={s.startMin}
                  style={{ flex: 1 }}
                  className="text-center"
                >
                  {s.startMin % 60 === 0 ? formatMinutes(s.startMin).replace(" ", "") : ""}
                </div>
              ))}
            </div>

            {/* Now indicator */}
            {isToday && <NowLine slots={slots} now={now} />}
          </div>

          {/* Mobile: vertical list (below md) */}
          <ul className="md:hidden divide-y divide-border/50">
            {slots.map((s, i) => {
              const label = `${formatMinutes(s.startMin)} — ${formatMinutes(s.endMin)}`
              if (s.status === "booked" && s.booking) {
                return (
                  <BookingPopover
                    key={i}
                    booking={s.booking}
                    startMin={s.startMin}
                    endMin={s.endMin}
                    canSeeNames={canSeeNames}
                    venueId={venueId}
                    onGoToBookings={() =>
                      navigate(`/bookings?venue=${venueId}&from=${iso}&to=${iso}`)
                    }
                  >
                    <li className="flex items-center justify-between gap-3 px-2 py-2.5 cursor-pointer hover:bg-muted/40 rounded">
                      <span className="font-mono text-xs text-foreground">{label}</span>
                      <span className="flex items-center gap-2 text-sm text-primary font-medium">
                        <User className="h-3.5 w-3.5" />
                        {canSeeNames ? s.booking.player.name : t("booked")}
                      </span>
                    </li>
                  </BookingPopover>
                )
              }
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center justify-between gap-3 px-2 py-2.5",
                    s.status === "past" && "opacity-60"
                  )}
                >
                  <span className="font-mono text-xs text-foreground">{label}</span>
                  <span
                    className={cn(
                      "text-xs",
                      s.status === "past" ? "text-muted-foreground" : "text-primary"
                    )}
                  >
                    {s.status === "past" ? t("past") : t("open")}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

// ---- sub-components ---------------------------------------------------------

function LegendDot({ className }: { className?: string }) {
  return <span className={cn("h-2.5 w-2.5 rounded-sm", className)} />
}

function NowLine({ slots, now }: { slots: Slot[]; now: Date }) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const first = slots[0]?.startMin ?? 0
  const last = slots[slots.length - 1]?.endMin ?? 0
  if (nowMin < first || nowMin > last) return null
  const pct = ((nowMin - first) / (last - first)) * 100
  return (
    <div
      className="relative -mt-[44px] h-10 pointer-events-none"
      aria-hidden
    >
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-destructive"
        style={{ left: `${pct}%` }}
      >
        <div className="absolute -top-1 -left-1.5 h-2.5 w-2.5 rounded-full bg-destructive" />
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
      <PopoverContent className="w-72 p-4 space-y-3" align="center">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {canSeeNames ? booking.player.name : t("booked")}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatMinutes(startMin)} — {formatMinutes(endMin)}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>
        <dl className="text-xs space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("sport")}</dt>
            <dd className="font-medium capitalize">{booking.sport}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("amount")}</dt>
            <dd className="font-medium">{formatCurrency(booking.totalAmount ?? booking.amount)}</dd>
          </div>
          {booking.paymentMethod && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("payment_method")}</dt>
              <dd className="font-medium uppercase">{booking.paymentMethod}</dd>
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
          <ArrowRight className="h-3.5 w-3.5 ms-1.5 rtl:rotate-180" />
        </Button>
      </PopoverContent>
    </Popover>
  )
}
