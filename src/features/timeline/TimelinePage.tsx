import { useEffect, useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  CalendarDays,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import api from "@/api/axios"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { getVenues, type Venue, type Pitch } from "@/api/venues"
import { getBookings, type Booking } from "@/api/bookings"
import { useRole, useOwnerFilter } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { LanesTimeline } from "./LanesTimeline"
import { Segmented } from "@/components/shared/design/Segmented"
import {
  parseHHMM,
  fmt12,
  fmtRange,
  hoursFor,
  renderStatusFor,
  STATUS_META,
  GROUP_META,
  colorFor,
  type StatusGroup,
} from "@/lib/timelineDesign"
import type { OperatingHours } from "@/lib/types"

// -------- utilities ---------------------------------------------------------

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
// NavGroup — prev / Today / next as a single bordered pill
// ---------------------------------------------------------------------------

function NavGroup({
  onPrev,
  onToday,
  onNext,
  isToday,
  todayLabel,
}: {
  onPrev: () => void
  onToday: () => void
  onNext: () => void
  isToday: boolean
  todayLabel: string
}) {
  return (
    <div className="inline-flex bg-card border border-[hsl(var(--line))] rounded-[10px] overflow-hidden">
      <NavBtn onClick={onPrev} ariaLabel="previous day">
        <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
      </NavBtn>
      <NavBtn onClick={onToday} wide highlight={!isToday}>
        {todayLabel}
      </NavBtn>
      <NavBtn onClick={onNext} ariaLabel="next day">
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </NavBtn>
    </div>
  )
}

function NavBtn({
  children,
  onClick,
  wide,
  highlight,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  wide?: boolean
  highlight?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center text-[12px] font-semibold bg-transparent border-0 border-s border-[hsl(var(--line))] first:border-s-0 text-[hsl(var(--ink-2))] hover:bg-[hsl(var(--surface-2))]",
        wide ? "h-[34px] px-3.5" : "h-[34px] w-[34px]",
        highlight && "text-[hsl(var(--ink))]",
      )}
    >
      {children}
    </button>
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

// ---------------------------------------------------------------------------
// BookingDrawer — right side sheet for a selected booking
// ---------------------------------------------------------------------------

function BookingDrawer({
  booking,
  onClose,
  onView,
  onCompleted,
}: {
  booking: Booking
  onClose: () => void
  onView: () => void
  onCompleted?: () => void
}) {
  const { t } = useT()
  const qc = useQueryClient()
  const startMin = parseHHMM(booking.startTime)
  const endMin = startMin + (booking.duration ?? 0)

  const complete = useMutation({
    mutationFn: () => api.patch(`/bookings/${booking.id}/complete`),
    onSuccess: () => {
      toast.success(t("mark_completed"))
      qc.invalidateQueries({ queryKey: ["timeline-bookings"] })
      qc.invalidateQueries({ queryKey: ["venue-slots"] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      onCompleted?.()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? t("manual_booking_failed"))
    },
  })

  const cancel = useMutation({
    mutationFn: () => api.patch(`/bookings/${booking.id}/cancel`),
    onSuccess: () => {
      toast.success(t("status_cancelled"))
      qc.invalidateQueries({ queryKey: ["timeline-bookings"] })
      qc.invalidateQueries({ queryKey: ["venue-slots"] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      onClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? t("manual_booking_failed"))
    },
  })

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle className="display tracking-[-0.02em]">
            {booking.player?.name ?? "—"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={booking.status} />
            <span className="mono text-[11.5px] text-[hsl(var(--ink-3))]">
              {fmtRange(startMin, endMin)}
            </span>
          </div>
          <div className="hair" />
          <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
            <InfoCell label={t("sport")} value={<span className="capitalize">{booking.sport}</span>} />
            <InfoCell label={t("duration")} value={`${booking.duration} min`} />
            <InfoCell label={t("amount")} value={formatCurrency(booking.totalAmount ?? booking.amount)} />
            {booking.paymentMethod && (
              <InfoCell label={t("payment_method")} value={<span className="uppercase">{booking.paymentMethod}</span>} />
            )}
            {booking.pitchSize && (
              <InfoCell label={t("pitch_size") ?? "Size"} value={`${booking.pitchSize}-aside`} />
            )}
          </dl>
          <div className="hair" />
          <div className="space-y-2">
            <Button size="sm" variant="outline" className="w-full" onClick={onView}>
              {t("view_drawer")}
            </Button>
            {booking.status === "confirmed" && (
              <Button
                size="sm"
                className="w-full gap-1"
                onClick={() => complete.mutate()}
                disabled={complete.isPending}
              >
                {complete.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("mark_completed")}
              </Button>
            )}
            {["pending", "pending_payment", "pending_review", "confirmed"].includes(
              booking.status,
            ) && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-[hsl(var(--rose-ink))] gap-1"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
              >
                {cancel.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("cancel")}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink-3))]">
        {label}
      </dt>
      <dd className="font-medium text-[hsl(var(--ink))] mt-0.5">{value}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AssignBookingDialog — identical logic to the previous build. Lets the user
// finalize the start/duration/sport/pitch/size drafted from drag-to-create
// or from the "Add booking" button.
// ---------------------------------------------------------------------------

function AssignBookingDialog({
  venueId,
  date,
  bookingDate,
  preset,
  sports,
  pricePerHour,
  pitches,
  minDuration,
  maxDuration,
  operatingHours,
  onClose,
}: {
  venueId: string
  date: string
  bookingDate: Date
  preset: {
    startMin?: number
    duration?: number
    sport?: string
    pitchId?: string
  } | null
  sports?: string[]
  pricePerHour?: number
  pitches: Pitch[]
  minDuration?: number
  maxDuration?: number
  operatingHours?: OperatingHours
  onClose: () => void
}) {
  const { t } = useT()
  const qc = useQueryClient()
  const [sport, setSport] = useState<string>(preset?.sport ?? sports?.[0] ?? "football")
  const [playerName, setPlayerName] = useState("")
  const [notes, setNotes] = useState("")

  const durationOptions = useMemo(() => {
    const all = [30, 60, 90, 120]
    const min = minDuration ?? 60
    const max = maxDuration ?? 180
    const filtered = all.filter((d) => d >= min && d <= max)
    return filtered.length > 0 ? filtered : [min]
  }, [minDuration, maxDuration])
  const [durationChoice, setDurationChoice] = useState<number>(preset?.duration ?? 60)
  const duration = durationOptions.includes(durationChoice)
    ? durationChoice
    : durationOptions[0]

  const sportPitches = useMemo(
    () => pitches.filter((p) => p.sport.toLowerCase() === sport.toLowerCase()),
    [pitches, sport],
  )
  const [pitchIdChoice, setPitchIdChoice] = useState<string>(preset?.pitchId ?? "")
  const pitchId =
    pitchIdChoice && sportPitches.some((p) => p.id === pitchIdChoice)
      ? pitchIdChoice
      : sportPitches[0]?.id ?? ""
  const selectedPitch = useMemo(
    () => sportPitches.find((p) => p.id === pitchId) ?? null,
    [sportPitches, pitchId],
  )

  const offeredSizes = useMemo(() => {
    if (!selectedPitch || selectedPitch.sport.toLowerCase() !== "football") return []
    const parent = selectedPitch.parentSize
    if (!parent) return []
    return [parent, ...(selectedPitch.subSizes ?? [])]
  }, [selectedPitch])
  const effectivePrices: Record<string, number> = useMemo(
    () => selectedPitch?.sizePrices ?? {},
    [selectedPitch],
  )
  const [pitchSizeChoice, setPitchSizeChoice] = useState<string | null>(null)
  const pitchSize: string | null =
    offeredSizes.length === 0
      ? null
      : pitchSizeChoice && offeredSizes.includes(pitchSizeChoice)
        ? pitchSizeChoice
        : offeredSizes[0]

  const [startMin, setStartMin] = useState<number>(preset?.startMin ?? 9 * 60)

  // Day's operating hours: pitch override wins, else venue. Returns null when closed.
  const dayHours = useMemo(
    () => hoursFor(selectedPitch?.operatingHours ?? operatingHours, bookingDate),
    [selectedPitch, operatingHours, bookingDate],
  )

  // 30-min slot list within the day's open/close window. Latest start is
  // `close - duration` so the booking always fits before close.
  const startOptions = useMemo(() => {
    if (!dayHours) return []
    const open = parseHHMM(dayHours.open)
    let close = parseHHMM(dayHours.close)
    if (close <= open) close += 24 * 60 // overnight (e.g. open 18:00, close 02:00)
    const last = close - duration
    const out: number[] = []
    for (let m = open; m <= last; m += 30) out.push(m)
    return out
  }, [dayHours, duration])

  // Snap startMin to a valid 30-min slot whenever the available slots change
  // (date, pitch, or duration changed). Avoids leaving the select on a value
  // that no longer exists in the list.
  useEffect(() => {
    if (startOptions.length === 0) return
    if (startOptions.includes(startMin)) return
    const nearest = startOptions.reduce(
      (best, m) => (Math.abs(m - startMin) < Math.abs(best - startMin) ? m : best),
      startOptions[0],
    )
    setStartMin(nearest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startOptions])

  const amount = useMemo(() => {
    const hours = duration / 60
    if (pitchSize && effectivePrices[pitchSize] != null) {
      return effectivePrices[pitchSize] * hours
    }
    const rate = selectedPitch?.pricePerHour ?? pricePerHour
    return rate ? rate * hours : null
  }, [pitchSize, effectivePrices, selectedPitch, pricePerHour, duration])

  const create = useMutation({
    mutationFn: async () => {
      const normalized = ((startMin % (24 * 60)) + 24 * 60) % (24 * 60)
      const startHH = String(Math.floor(normalized / 60)).padStart(2, "0")
      const startMM = String(normalized % 60).padStart(2, "0")
      const notePrefix = `[MANUAL] [${sport}]`
      const walkIn = playerName ? ` Walk-in: ${playerName}.` : ""
      const extra = notes ? ` ${notes}` : ""
      const pitchIdToSend =
        pitchId && !pitchId.startsWith("legacy-") ? pitchId : undefined
      const res = await api.post("/bookings", {
        venueId,
        sport,
        date,
        startTime: `${startHH}:${startMM}`,
        duration,
        paymentMethod: "cliq",
        notes: `${notePrefix}${walkIn}${extra}`.trim(),
        isManual: true,
        ...(pitchSize ? { pitchSize } : {}),
        ...(pitchIdToSend ? { pitchId: pitchIdToSend } : {}),
      })
      return res.data
    },
    onSuccess: () => {
      toast.success(t("manual_booking_created"))
      qc.invalidateQueries({ queryKey: ["timeline-bookings"] })
      qc.invalidateQueries({ queryKey: ["venue-slots"] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      onClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? t("manual_booking_failed"))
    },
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="display tracking-[-0.02em]">
            {t("draft_review")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("start_time")}>
              {dayHours ? (
                <select
                  value={String(startMin)}
                  onChange={(e) => setStartMin(Number(e.target.value))}
                  disabled={startOptions.length === 0}
                  className="mono h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none disabled:opacity-50"
                >
                  {startOptions.length === 0 ? (
                    <option value="">—</option>
                  ) : (
                    startOptions.map((m) => (
                      <option key={m} value={m}>
                        {fmt12(m)}
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <div className="mono h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm flex items-center text-[hsl(var(--ink-3))]">
                  {t("venue_closed_day")}
                </div>
              )}
            </Field>
            <Field label={t("duration")}>
              <select
                value={duration}
                onChange={(e) => setDurationChoice(Number(e.target.value))}
                className="mono h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"
              >
                {durationOptions.map((d) => (
                  <option key={d} value={d}>
                    {d === 30
                      ? "30 min"
                      : d === 60
                        ? "1 h"
                        : d === 90
                          ? "1 h 30"
                          : d === 120
                            ? "2 h"
                            : `${d} min`}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t("sport")}>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm capitalize text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"
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
          </Field>

          {sportPitches.length > 1 && (
            <Field label={t("pitch") ?? "Pitch"}>
              <select
                value={pitchId}
                onChange={(e) => setPitchIdChoice(e.target.value)}
                className="h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"
              >
                {sportPitches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.parentSize ? ` · ${p.parentSize}-aside` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {offeredSizes.length > 1 && (
            <Field label={t("pitch_size") ?? "Pitch size"}>
              <select
                value={pitchSize ?? ""}
                onChange={(e) => setPitchSizeChoice(e.target.value)}
                className="mono h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"
              >
                {offeredSizes.map((s) => {
                  const price = effectivePrices[s]
                  return (
                    <option key={s} value={s}>
                      {s}-aside
                      {price != null ? ` · ${formatCurrency(price)}/h` : ""}
                    </option>
                  )
                })}
              </select>
            </Field>
          )}

          <Field label={t("player_name")}>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={t("player_name_placeholder")}
              className="h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-3))] focus:border-[hsl(var(--brand))] focus:outline-none"
            />
          </Field>

          <Field label={t("notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t("notes_placeholder")}
              className="w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 py-1.5 text-sm text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-3))] focus:border-[hsl(var(--brand))] focus:outline-none"
            />
          </Field>

          {amount != null && (
            <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--brand-tint))] px-3 py-2 text-sm">
              <span className="text-[hsl(var(--brand-ink))]">{t("estimated_amount")}</span>
              <span className="mono font-semibold text-[hsl(var(--brand-ink))]">
                {formatCurrency(amount)}
              </span>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            <X className="h-3.5 w-3.5" />
            {t("cancel")}
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !dayHours || startOptions.length === 0}
            className="gap-1"
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {t("draft_create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink-3))]">
        {label}
      </span>
      {children}
    </label>
  )
}
