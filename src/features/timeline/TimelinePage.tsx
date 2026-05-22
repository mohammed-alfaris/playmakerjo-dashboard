import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  Plus,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getVenues, type Venue } from "@/api/venues"
import { getBookings, type Booking } from "@/api/bookings"
import { useRole, useOwnerFilter } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { LanesTimeline } from "./LanesTimeline"
import { Segmented } from "@/components/shared/design/Segmented"
import {
  renderStatusFor,
  STATUS_META,
  GROUP_META,
  colorFor,
  type StatusGroup,
} from "@/lib/timelineDesign"

import { toISODate, addDays } from "./shared/dateUtils"
import { NavGroup } from "./shared/NavGroup"
import { BookingDrawer } from "./shared/BookingDrawer"
import { AssignBookingDialog } from "./shared/AssignBookingDialog"

// ---------------------------------------------------------------------------
// TimelinePage — "Clean" Lanes variant. The data/query layer (venues, bookings,
// manual-booking POST) is unchanged from the previous grid version. Only the
// shell + rendering switched to the clean redesign's visual language.
// ---------------------------------------------------------------------------

type FilterId = "all" | StatusGroup

export default function TimelinePage() {
  const { t, lang } = useT()
  const ownerFilter = useOwnerFilter()
  const { isAdmin, isOwner } = useRole()
  const canManage = isAdmin || isOwner
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [selectedId, setSelectedId] = useState<string>("")
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftPreset, setDraftPreset] = useState<{
    startMin?: number
    duration?: number
    sport?: string
    pitchId?: string
  } | null>(null)
  const [drawerBooking, setDrawerBooking] = useState<Booking | null>(null)
  const [filter, setFilter] = useState<FilterId>("all")

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

  const iso = toISODate(selectedDate)
  const now = new Date()
  const todayIso = toISODate(now)
  const isToday = iso === todayIso
  const isPastDate = iso < todayIso

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

  // Group counts for the filter pills
  const counts = useMemo(() => {
    const g: Record<FilterId, number> = {
      all: bookings.length,
      confirmed: 0,
      hold: 0,
      done: 0,
      issue: 0,
      open: 0,
      blocked: 0,
    }
    for (const b of bookings) {
      const status = renderStatusFor(b)
      const group = STATUS_META[status]?.group
      if (group && group !== "open" && group !== "blocked") g[group]++
    }
    return g
  }, [bookings])

  // Day revenue (exclude cancelled / no-show)
  const revenue = useMemo(() => {
    let sum = 0
    for (const b of bookings) {
      if (b.status === "cancelled" || b.status === "no_show") continue
      sum += b.totalAmount ?? b.amount ?? 0
    }
    return sum
  }, [bookings])

  // Filter bookings by active pill
  const visibleBookings = useMemo(() => {
    if (filter === "all") return bookings
    return bookings.filter((b) => {
      const status = renderStatusFor(b)
      return STATUS_META[status]?.group === filter
    })
  }, [bookings, filter])

  const locale = lang === "ar" ? "ar-JO" : "en-GB"
  const displayDate = new Date(iso + "T00:00:00")
  const dateLabel = displayDate.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  function goDay(delta: number) {
    setSelectedDate((d) => addDays(d, delta))
  }

  const filterPills: Array<{ id: FilterId; label: string; color?: keyof typeof GROUP_META }> = [
    { id: "all", label: t("filter_all") },
    { id: "confirmed", label: t("group_confirmed"), color: "confirmed" },
    { id: "hold", label: t("filter_needs_action"), color: "hold" },
    { id: "done", label: t("filter_completed"), color: "done" },
    { id: "issue", label: t("filter_issues"), color: "issue" },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Hero header — big date + nav group | stat pills + new booking */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-[hsl(var(--ink))] leading-[1.1]">
            {dateLabel}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <NavGroup
              onPrev={() => goDay(-1)}
              onToday={() => setSelectedDate(new Date())}
              onNext={() => goDay(1)}
              isToday={isToday}
              todayLabel={t("today")}
            />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <StatPill label={t("revenue_label")} value={formatCurrency(revenue)} />
          <StatPill label={t("bookings_label")} value={counts.all} />
          {canManage && selectedVenue && (
            <Button
              size="sm"
              className="h-9 gap-1.5 rounded-[10px] font-semibold"
              onClick={() => {
                setDraftPreset(null)
                setDraftOpen(true)
              }}
              disabled={isPastDate}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("new_booking")}
            </Button>
          )}
        </div>
      </div>

      {/* Venue selector (kept: we support many venues) */}
      {venues.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {venuesLoading && (
            <span className="text-[11px] text-[hsl(var(--ink-3))]">…</span>
          )}
          {venues.map((v) => {
            const active = v.id === effectiveId
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={cn(
                  "inline-flex items-center h-8 rounded-full px-3.5 text-[12px] font-semibold transition-colors border",
                  active
                    ? "bg-[hsl(var(--brand))] text-white border-transparent"
                    : "bg-card text-[hsl(var(--ink-2))] border-[hsl(var(--line))] hover:text-[hsl(var(--ink))]",
                )}
              >
                {v.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Filter pills + Day/Week segmented */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterPills.map((g) => {
            const active = filter === g.id
            const c = g.color ? colorFor(GROUP_META[g.color].color) : null
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setFilter(g.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold transition-colors",
                )}
                style={
                  active
                    ? c
                      ? { background: c.tint, color: c.ink, border: "none" }
                      : { background: "hsl(var(--ink))", color: "#fff", border: "none" }
                    : {
                        background: "hsl(var(--card))",
                        color: "hsl(var(--ink-2))",
                        border: "1px solid hsl(var(--line))",
                      }
                }
              >
                {c && (
                  <span
                    aria-hidden
                    className="inline-block rounded-full"
                    style={{ width: 7, height: 7, background: c.bg }}
                  />
                )}
                {g.label}
                <span
                  className="num text-[11px] font-bold"
                  style={{ opacity: active ? 0.8 : 0.5 }}
                >
                  {counts[g.id]}
                </span>
              </button>
            )
          })}
        </div>
        <Segmented
          value="day"
          onChange={() => {}}
          options={[
            { value: "day", label: lang === "ar" ? "يوم" : "Day" },
            { value: "week", label: lang === "ar" ? "أسبوع" : "Week", disabled: true, title: "Coming soon" },
          ]}
        />
      </div>

      {/* Loading */}
      {(venuesLoading || bookingsLoading) && (
        <div className="h-[320px] w-full rounded-[16px] bg-[hsl(var(--surface-2))] animate-pulse" />
      )}

      {/* Empty */}
      {!venuesLoading && venues.length === 0 && (
        <div className="rounded-[16px] bg-card border border-[hsl(var(--line))] p-10 text-center shadow-sm-stadium">
          <CalendarDays className="mx-auto mb-2 h-6 w-6 text-[hsl(var(--ink-3))]" />
          <p className="text-sm text-[hsl(var(--ink-2))]">{t("no_venues_available")}</p>
        </div>
      )}

      {/* Lanes timeline */}
      {!venuesLoading && !bookingsLoading && selectedVenue && (
        <LanesTimeline
          venue={selectedVenue}
          bookings={visibleBookings}
          date={selectedDate}
          canManage={canManage && !isPastDate}
          onCreate={(args) => {
            setDraftPreset({
              startMin: args.startMin,
              duration: args.duration,
              sport: args.sport,
              pitchId: args.pitchId,
            })
            setDraftOpen(true)
          }}
          onOpenBooking={(b) => setDrawerBooking(b)}
        />
      )}

      {/* Draft / assign booking dialog */}
      {draftOpen && selectedVenue && (
        <AssignBookingDialog
          venueId={selectedVenue.id}
          date={iso}
          bookingDate={selectedDate}
          preset={draftPreset}
          sports={selectedVenue.sports}
          pricePerHour={selectedVenue.pricePerHour}
          pitches={selectedVenue.pitches ?? []}
          minDuration={selectedVenue.minBookingDuration}
          maxDuration={selectedVenue.maxBookingDuration}
          operatingHours={selectedVenue.operatingHours}
          onClose={() => {
            setDraftOpen(false)
            // Clear the preset so the next time the dialog opens (drag-create
            // sets its own preset; "New Booking" button resets to null) it
            // doesn't briefly flash the previous booking's values.
            setDraftPreset(null)
          }}
        />
      )}

      {/* Booking detail drawer */}
      {drawerBooking && (
        <BookingDrawer
          booking={drawerBooking}
          onClose={() => setDrawerBooking(null)}
          onView={() => {
            const id = drawerBooking.id
            navigate(`/bookings?venue=${effectiveId}&from=${iso}&to=${iso}&highlight=${id}`)
          }}
          onCompleted={() => {
            setDrawerBooking(null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatPill — small two-line KPI tile for the header
// ---------------------------------------------------------------------------

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border border-[hsl(var(--line))] rounded-[10px] px-3.5 py-2 leading-tight">
      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[hsl(var(--ink-3))]">
        {label}
      </div>
      <div className="num display text-[17px] font-bold text-[hsl(var(--ink))] mt-0.5 whitespace-nowrap">
        {value}
      </div>
    </div>
  )
}
