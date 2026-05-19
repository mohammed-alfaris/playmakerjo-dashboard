import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getBookings, type Booking } from "@/api/bookings"
import type { Venue } from "@/api/venues"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { LanesTimeline } from "@/features/timeline/LanesTimeline"
import {
  renderStatusFor,
  STATUS_META,
  GROUP_META,
  colorFor,
  type StatusGroup,
} from "@/lib/timelineDesign"

import { toISODate, addDays } from "@/features/timeline/shared/dateUtils"
import { NavGroup } from "@/features/timeline/shared/NavGroup"
import { BookingDrawer } from "@/features/timeline/shared/BookingDrawer"
import { AssignBookingDialog } from "@/features/timeline/shared/AssignBookingDialog"

// ---------------------------------------------------------------------------
// Compact Venue timeline — embedded on the profile page. Same Clean Lanes grid
// as the main TimelinePage but with a smaller header (no venue picker) and a
// compact nav group.
// ---------------------------------------------------------------------------

type FilterId = "all" | StatusGroup

export function VenueSlotTimeline({ venue }: { venue: Venue }) {
  const { t, lang } = useT()
  const { isAdmin, isOwner } = useRole()
  const canManage = isAdmin || isOwner
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftPreset, setDraftPreset] = useState<{
    startMin?: number
    duration?: number
    sport?: string
    pitchId?: string
  } | null>(null)
  const [drawerBooking, setDrawerBooking] = useState<Booking | null>(null)
  const [filter, setFilter] = useState<FilterId>("all")

  const iso = toISODate(selectedDate)
  const todayIso = toISODate(new Date())
  const isToday = iso === todayIso
  const isPastDate = iso < todayIso

  const { data, isLoading } = useQuery({
    queryKey: ["venue-slots", venue.id, iso],
    queryFn: () =>
      getBookings({ venue_id: venue.id, from: iso, to: iso, page: 1, limit: 100 }),
    enabled: !!venue.id,
  })
  const bookings: Booking[] = useMemo(() => data?.data ?? [], [data])

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

  const revenue = useMemo(() => {
    let sum = 0
    for (const b of bookings) {
      if (b.status === "cancelled" || b.status === "no_show") continue
      sum += b.totalAmount ?? b.amount ?? 0
    }
    return sum
  }, [bookings])

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
    <div className="space-y-4">
      {/* Compact header: eyebrow + date + NavGroup | StatPill + New booking */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[hsl(var(--ink-3))]">
            {t("slot_timeline")}
          </div>
          <h2 className="display text-[22px] font-semibold tracking-[-0.02em] text-[hsl(var(--ink))] leading-[1.15] mt-1 truncate">
            {dateLabel}
          </h2>
          <div className="mt-2">
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
          {canManage && (
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

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {filterPills.map((g) => {
          const active = filter === g.id
          const c = g.color ? colorFor(GROUP_META[g.color].color) : null
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setFilter(g.id)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11.5px] font-semibold transition-colors"
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
                  style={{ width: 6, height: 6, background: c.bg }}
                />
              )}
              {g.label}
              <span
                className="num text-[10.5px] font-bold"
                style={{ opacity: active ? 0.8 : 0.5 }}
              >
                {counts[g.id]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="h-[220px] w-full rounded-[16px] bg-[hsl(var(--surface-2))] animate-pulse" />
      )}

      {/* Lanes grid */}
      {!isLoading && (
        <LanesTimeline
          venue={venue}
          bookings={visibleBookings}
          date={selectedDate}
          compact
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

      {/* Manual booking dialog */}
      {draftOpen && (
        <AssignBookingDialog
          venueId={venue.id}
          date={iso}
          preset={draftPreset}
          sports={venue.sports}
          pricePerHour={venue.pricePerHour}
          pitches={venue.pitches ?? []}
          minDuration={venue.minBookingDuration}
          maxDuration={venue.maxBookingDuration}
          onClose={() => setDraftOpen(false)}
        />
      )}

      {/* Booking detail drawer */}
      {drawerBooking && (
        <BookingDrawer
          booking={drawerBooking}
          onClose={() => setDrawerBooking(null)}
          onView={() => {
            const id = drawerBooking.id
            navigate(
              `/bookings?venue=${venue.id}&from=${iso}&to=${iso}&highlight=${id}`,
            )
          }}
          onCompleted={() => setDrawerBooking(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatPill — compact header KPI (kept local — slightly different sizing from
// the TimelinePage variant)
// ---------------------------------------------------------------------------

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border border-[hsl(var(--line))] rounded-[10px] px-3 py-1.5 leading-tight">
      <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[hsl(var(--ink-3))]">
        {label}
      </div>
      <div className="num display text-[15px] font-bold text-[hsl(var(--ink))] mt-0.5 whitespace-nowrap">
        {value}
      </div>
    </div>
  )
}
