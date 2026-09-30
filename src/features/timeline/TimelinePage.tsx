import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  Ban,
  Plus,
  CalendarDays,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getVenues, type Venue } from "@/api/venues"
import { getBookings, type Booking } from "@/api/bookings"
import { listPermanentBookings, recordStandingWeek, type PermanentBooking } from "@/api/permanentBookings"
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

import { toISODate, addDays, weekStartOf, SCHEDULE_REFRESH_MS } from "./shared/dateUtils"
import { WeekView } from "./WeekView"
import { NavGroup } from "./shared/NavGroup"
import { BookingDrawer } from "./shared/BookingDrawer"
import { AssignBookingDialog } from "./shared/AssignBookingDialog"
import { BlockTimeDialog } from "./shared/BlockTimeDialog"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { deleteBlock, listBlocks, type VenueBlock } from "@/api/blocks"

// ---------------------------------------------------------------------------
// TimelinePage — "Clean" Lanes variant. The data/query layer (venues, bookings,
// manual-booking POST) is unchanged from the previous grid version. Only the
// shell + rendering switched to the clean redesign's visual language.
// ---------------------------------------------------------------------------

type FilterId = "all" | StatusGroup

export default function TimelinePage() {
  const { t, lang } = useT()
  const ownerFilter = useOwnerFilter()
  const { can } = useRole()
  // Staff whose role lets them manage bookings take bookings too — this used to be
  // admin/owner only, which is precisely why a counter clerk could not do their job.
  const canManage = can("bookings.manage")
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
  const [view, setView] = useState<"day" | "week">("day")
  const [blockOpen, setBlockOpen] = useState(false)
  const [removingBlock, setRemovingBlock] = useState<VenueBlock | null>(null)
  const qc = useQueryClient()

  /**
   * Turn this week of a standing reservation into a real booking.
   *
   * The rule blocks the slot every week and never becomes a row, so until now the group's
   * cash had nowhere to go: no booking to collect against, and booking the slot normally
   * was refused by the group's own reservation. Created unpaid — a weekly group pays on
   * the night — so it lands in "owes money" until the counter collects.
   */
  const recordWeek = useMutation({
    mutationFn: (p: PermanentBooking) => recordStandingWeek(p.id, iso),
    onSuccess: (rec) => {
      toast.success(t("standing_recorded").replace("{amount}", String(rec.totalAmount)))
      qc.invalidateQueries({ queryKey: ["timeline-bookings"] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      qc.invalidateQueries({ queryKey: ["customers"] })
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? t("something_went_wrong"))
    },
  })

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
    // The desk keeps this screen open all day: pick up bookings made in the app or at the
    // other desk without anyone pressing refresh. Paused while the tab is in the background.
    refetchInterval: SCHEDULE_REFRESH_MS,
  })
  const bookings: Booking[] = useMemo(
    () => bookingsData?.data ?? [],
    [bookingsData]
  )

  // Standing weekly reservations. Not keyed by date — a permanent has no date, so this is
  // fetched once per venue and filtered to the weekday inside LanesTimeline.
  //
  // Until now the schedule never asked for these at all, while the server had always
  // honoured them in its conflict scan. The two disagreed: the hour looked free here and
  // the booking was refused at save, after the customer had been promised it.
  const { data: permanents } = useQuery({
    queryKey: ["timeline-permanents", effectiveId],
    queryFn: () => listPermanentBookings(effectiveId, "active"),
    enabled: !!effectiveId,
    // They change rarely; refetching per date change would be pure noise.
    staleTime: 5 * 60_000,
  })

  // Blocked time for what is on screen: the day (and the night after it, which a late window
  // reaches), or the whole week.
  const blockFrom = view === "week" ? toISODate(weekStartOf(selectedDate)) : iso
  const blockTo = view === "week" ? toISODate(addDays(weekStartOf(selectedDate), 6)) : toISODate(addDays(selectedDate, 1))
  const { data: blocks } = useQuery({
    queryKey: ["venue-blocks", effectiveId, blockFrom, blockTo],
    queryFn: () => listBlocks(effectiveId, blockFrom, blockTo),
    enabled: !!effectiveId,
    refetchInterval: SCHEDULE_REFRESH_MS,
  })

  const removeBlock = useMutation({
    mutationFn: (b: VenueBlock) => deleteBlock(b.venueId, b.id),
    onSuccess: () => {
      toast.success(t("block_removed"))
      qc.invalidateQueries({ queryKey: ["venue-blocks"] })
      qc.invalidateQueries({ queryKey: ["venue-slots"] })
      setRemovingBlock(null)
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("something_went_wrong")),
  })

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
  const weekStart = weekStartOf(selectedDate)
  const dateLabel = view === "week"
    ? `${weekStart.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`
    : displayDate.toLocaleDateString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })

  function goDay(delta: number) {
    setSelectedDate((d) => addDays(d, view === "week" ? delta * 7 : delta))
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
              isToday={view === "week" ? toISODate(weekStart) === toISODate(weekStartOf(now)) : isToday}
              todayLabel={t("today")}
            />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Staff run the schedule; what it earns is for those allowed to see reports.
              Taking bookings is about slots, not money. */}
          {/* The pills describe one day; in the week view each column carries its own count. */}
          {view === "day" && can("reports.view") && (
            <StatPill label={t("revenue_label")} value={formatCurrency(revenue)} />
          )}
          {view === "day" && <StatPill label={t("bookings_label")} value={counts.all} />}
          {canManage && selectedVenue && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 rounded-[10px] font-semibold"
              onClick={() => setBlockOpen(true)}
              disabled={isPastDate}
            >
              <Ban className="h-3.5 w-3.5" />
              {t("block_time")}
            </Button>
          )}
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
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: t("view_day") },
            { value: "week", label: t("view_week") },
          ]}
        />
      </div>

      {/* Loading */}
      {(venuesLoading || (view === "day" && bookingsLoading)) && (
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
      {view === "week" && !venuesLoading && selectedVenue && (
        <WeekView
          venue={selectedVenue}
          weekOf={selectedDate}
          permanents={permanents}
          blocks={blocks}
          onOpenBlock={canManage ? setRemovingBlock : undefined}
          filter={filter}
          onOpenBooking={(b) => setDrawerBooking(b)}
          onOpenDay={(d) => {
            setSelectedDate(d)
            setView("day")
          }}
        />
      )}

      {view === "day" && !venuesLoading && !bookingsLoading && selectedVenue && (
        <LanesTimeline
          venue={selectedVenue}
          bookings={visibleBookings}
          // Not filtered by the status pills: a standing reservation has no status to
          // filter on, and hiding it would put the clerk right back where they started.
          permanents={permanents}
          // Only offered to someone who can take money, and never for a past day.
          onRecordStanding={can("standing.manage") && !isPastDate ? (p) => recordWeek.mutate(p) : undefined}
          date={selectedDate}
          blocks={blocks}
          onOpenBlock={canManage ? setRemovingBlock : undefined}
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
          // Unfiltered by the status pills on purpose: a slot is taken whether or not the
          // clerk is currently looking at that status.
          dayBookings={bookings}
          dayPermanents={permanents}
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

      {blockOpen && selectedVenue && (
        <BlockTimeDialog
          venueId={selectedVenue.id}
          pitches={selectedVenue.pitches ?? []}
          date={iso}
          onClose={() => setBlockOpen(false)}
        />
      )}

      <ConfirmDialog
        title={t("block_remove")}
        description={removingBlock ? describeBlock(removingBlock) : ""}
        open={!!removingBlock}
        onOpenChange={(open) => { if (!open) setRemovingBlock(null) }}
        onConfirm={() => removingBlock && removeBlock.mutate(removingBlock)}
        isLoading={removeBlock.isPending}
        confirmLabel={t("block_remove")}
      />

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

/** "Pitch repair · 2026-09-30 11:00–13:00", or both dates when it spans days. */
function describeBlock(b: VenueBlock) {
  const [fd, ft] = b.startsAt.split("T")
  const [td, tt] = b.endsAt.split("T")
  const span = fd === td ? `${fd} ${ft}–${tt}` : `${fd} ${ft} – ${td} ${tt}`
  return b.reason ? `${b.reason} · ${span}` : span
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
