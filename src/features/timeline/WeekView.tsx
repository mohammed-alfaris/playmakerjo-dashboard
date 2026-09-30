import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Repeat } from "lucide-react"
import { getBookings, type Booking } from "@/api/bookings"
import type { PermanentBooking } from "@/api/permanentBookings"
import type { Venue } from "@/api/venues"
import { useT } from "@/i18n/LanguageContext"
import { bookingPersonName } from "@/lib/bookingParty"
import { STATUS_META, colorFor, parseHHMM, fmtRange, renderStatusFor, type StatusGroup } from "@/lib/timelineDesign"
import { cn } from "@/lib/utils"
import { SCHEDULE_REFRESH_MS, addDays, toISODate, weekStartOf } from "./shared/dateUtils"

type Item =
  | { kind: "booking"; start: number; end: number; booking: Booking }
  | { kind: "standing"; start: number; end: number; standing: PermanentBooking }

/**
 * The week at a glance for one venue: seven columns, each day's bookings and standing
 * reservations in time order. For planning the week — who is in when, where the gaps are —
 * not for editing; clicking a booking opens it, clicking a day opens that day's lanes.
 */
export function WeekView({
  venue,
  weekOf,
  permanents,
  filter,
  onOpenBooking,
  onOpenDay,
}: {
  venue: Venue
  weekOf: Date
  permanents?: PermanentBooking[]
  filter: StatusGroup | "all"
  onOpenBooking: (b: Booking) => void
  onOpenDay: (d: Date) => void
}) {
  const { t, lang } = useT()
  const start = weekStartOf(weekOf)
  const startMs = start.getTime()
  const from = toISODate(start)
  const to = toISODate(addDays(start, 6))
  const todayIso = toISODate(new Date())

  const { data, isLoading } = useQuery({
    queryKey: ["timeline-week", venue.id, from],
    queryFn: () => getBookings({ venue_id: venue.id, from, to, page: 1, limit: 500 }),
    refetchInterval: SCHEDULE_REFRESH_MS,
  })

  const pitchName = (id?: string | null) => {
    const p = venue.pitches?.find((x) => x.id === id)
    return p ? (lang === "ar" && p.nameAr ? p.nameAr : p.name) : null
  }

  const days = useMemo(() => {
    const bookings: Booking[] = data?.data ?? []
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(new Date(startMs), i)
      const iso = toISODate(date)
      const dayBookings = bookings.filter((b) => b.date.slice(0, 10) === iso)
      const items: Item[] = dayBookings
        .filter((b) => filter === "all" || STATUS_META[renderStatusFor(b)]?.group === filter)
        .map((b) => {
          const s = parseHHMM(b.startTime)
          return { kind: "booking" as const, start: s, end: s + (b.duration ?? 60), booking: b }
        })
      // A standing reservation shows unless that week was already recorded as a booking at
      // the same time on the same pitch — then the booking stands for it.
      if (filter === "all" || filter === "confirmed") {
        for (const p of permanents ?? []) {
          if (p.status !== "active" || p.dayOfWeek !== date.getDay()) continue
          const s = parseHHMM(p.startTime)
          const recorded = dayBookings.some((b) =>
            b.status !== "cancelled" && parseHHMM(b.startTime) === s && (b.pitchId ?? null) === (p.pitchId ?? b.pitchId ?? null))
          if (!recorded) items.push({ kind: "standing", start: s, end: s + p.duration, standing: p })
        }
      }
      items.sort((a, b) => a.start - b.start)
      const live = dayBookings.filter((b) => b.status !== "cancelled").length
      return { date, iso, items, live }
    })
  }, [data, permanents, filter, startMs])

  const weekday = new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", { weekday: "short" })
  const dayNum = new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", { day: "numeric", month: "short" })

  if (isLoading) {
    return <div className="h-[420px] w-full rounded-[16px] bg-[hsl(var(--surface-2))] animate-pulse" />
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((d) => {
        const isToday = d.iso === todayIso
        return (
          <div
            key={d.iso}
            className={cn(
              "flex min-h-[220px] flex-col rounded-[14px] border bg-card shadow-sm-stadium",
              isToday ? "border-[hsl(var(--brand))]" : "border-[hsl(var(--line))]",
            )}
          >
            <button
              type="button"
              onClick={() => onOpenDay(d.date)}
              title={t("week_open_day")}
              className="flex items-baseline justify-between gap-2 border-b border-[hsl(var(--line))] px-3 py-2 text-start hover:bg-[hsl(var(--surface-2))] rounded-t-[14px]"
            >
              <span>
                <span className={cn("text-[11px] font-bold uppercase tracking-[0.06em]", isToday ? "text-[hsl(var(--brand))]" : "text-[hsl(var(--ink-3))]")}>
                  {weekday.format(d.date)}
                </span>
                <span className="ms-1.5 text-sm font-semibold text-[hsl(var(--ink))]">{dayNum.format(d.date)}</span>
              </span>
              <span className="num text-[11px] font-semibold text-[hsl(var(--ink-3))]">{d.live}</span>
            </button>

            <div className="flex-1 space-y-1.5 p-2">
              {d.items.length === 0 && (
                <p className="px-1 py-3 text-center text-[11px] text-[hsl(var(--ink-3))]">{t("week_free_day")}</p>
              )}
              {d.items.map((it) => {
                if (it.kind === "standing") {
                  const p = it.standing
                  return (
                    <div
                      key={`s-${p.id}`}
                      className="rounded-[8px] border border-dashed border-[hsl(var(--line-strong))] px-2 py-1.5 text-[11.5px]"
                      title={t("week_standing")}
                    >
                      <div className="num flex items-center gap-1 font-semibold text-[hsl(var(--ink-2))]">
                        <Repeat className="h-3 w-3" />
                        {fmtRange(it.start, it.end)}
                      </div>
                      <div className="truncate text-[hsl(var(--ink-2))]">
                        {(lang === "ar" && p.labelAr) || p.label || p.customer?.name || t("week_standing")}
                      </div>
                      {pitchName(p.pitchId) && <div className="truncate text-[10.5px] text-[hsl(var(--ink-3))]">{pitchName(p.pitchId)}</div>}
                    </div>
                  )
                }
                const b = it.booking
                const meta = STATUS_META[renderStatusFor(b)]
                const c = colorFor(meta.color)
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onOpenBooking(b)}
                    className={cn(
                      "block w-full rounded-[8px] px-2 py-1.5 text-start text-[11.5px] transition-opacity hover:opacity-85",
                      b.status === "cancelled" && "opacity-50 line-through",
                    )}
                    style={{ background: c.tint, borderInlineStart: `3px solid ${c.bg}` }}
                  >
                    <div className="num font-semibold" style={{ color: c.ink }}>{fmtRange(it.start, it.end)}</div>
                    <div className="truncate text-[hsl(var(--ink))]">{bookingPersonName(b, t("walk_in_customer"))}</div>
                    {pitchName(b.pitchId) && <div className="truncate text-[10.5px] text-[hsl(var(--ink-3))]">{pitchName(b.pitchId)}</div>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
