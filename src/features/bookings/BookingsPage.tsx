import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { CalendarCheck, X, Eye, Repeat, Ban, CheckCircle, UserX, Store, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { ProofReviewDialog } from "./ProofReviewDialog"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getBookings, cancelSeries, cancelBooking, completeBooking, markNoShow, type Booking } from "@/api/bookings"
import { getVenues, type Venue } from "@/api/venues"
import { usePagination } from "@/hooks/usePagination"
import { useOwnerFilter, useRole } from "@/hooks/useRole"
import { BOOKING_STATUSES } from "@/lib/constants"
import { formatCurrency, formatDateTime } from "@/lib/formatters"
import { bookingPersonName, bookingPersonPhone } from "@/lib/bookingParty"
import { useT } from "@/i18n/LanguageContext"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"

const DATE_INPUT_CLASS =
  "flex h-9 w-36 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"

// Mirrors the backend's allowed transitions in BookingsController.Cancel — everything except
// cancelled/completed/no_show, which are terminal states the API itself refuses to touch.
const CANCELLABLE_STATUSES = ["pending", "pending_payment", "pending_review", "confirmed"]

export default function BookingsPage() {
  const { page, limit, setPage, resetPage } = usePagination()
  const ownerFilter = useOwnerFilter()
  const { t, lang } = useT()

  const [status,   setStatus]   = useState("all")
  const [from,     setFrom]     = useState("")
  const [to,       setTo]       = useState("")
  const [venue_id, setVenueId]  = useState("all")
  const [pitch_id, setPitchId]  = useState("all")
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null)
  const [cancelGroupId, setCancelGroupId] = useState<string | null>(null)
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null)
  const [completeBookingId, setCompleteBookingId] = useState<string | null>(null)
  const [noShowBookingId, setNoShowBookingId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { isAdmin, isOwner } = useRole()

  const cancelSeriesMutation = useMutation({
    mutationFn: (groupId: string) => cancelSeries(groupId),
    onSuccess: () => {
      toast.success(t("series_cancelled"))
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      setCancelGroupId(null)
    },
    onError: () => toast.error(t("series_cancel_failed")),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeBooking(id),
    onSuccess: () => {
      toast.success(t("booking_completed"))
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      setCompleteBookingId(null)
    },
    // Surface the server's own message — this is how "still owes 20 JOD" reaches the
    // owner instead of a generic failure that doesn't say why.
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("booking_complete_failed")),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: () => {
      toast.success(t("booking_cancelled_toast"))
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      setCancelBookingId(null)
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("manual_booking_failed")),
  })

  const noShowMutation = useMutation({
    mutationFn: (id: string) => markNoShow(id),
    onSuccess: () => {
      toast.success(t("booking_no_show_marked"))
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      setNoShowBookingId(null)
    },
    onError: () => toast.error(t("booking_no_show_failed")),
  })

  const handleFilterChange = useCallback(
    (setter: (v: string) => void) => (v: string) => { setter(v); resetPage() },
    [resetPage]
  )

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", { page, limit, status, from, to, venue_id, pitch_id, ...ownerFilter }],
    queryFn: () => getBookings({
      page, limit,
      status:   status   === "all" ? undefined : status,
      from:     from     || undefined,
      to:       to       || undefined,
      venue_id: venue_id === "all" ? undefined : venue_id,
      pitch_id: pitch_id === "all" ? undefined : pitch_id,
      ...ownerFilter,
    }),
  })

  const { data: venuesData } = useQuery({
    queryKey: ["venues-for-bookings", ownerFilter],
    queryFn: () => getVenues({ limit: 100, ...ownerFilter }),
  })

  const bookings: Booking[] = data?.data ?? []
  const pagination          = data?.pagination ?? { page, limit, total: 0 }
  const venueOptions: Venue[] = venuesData?.data ?? []

  // What completing this booking will collect, shown in the confirm dialog so the amount is
  // never a surprise after the fact.
  const completeTarget = bookings.find((b) => b.id === completeBookingId)
  const completeRemaining = completeTarget
    ? Math.max(0, (completeTarget.totalAmount ?? completeTarget.amount) - (completeTarget.amountPaid ?? 0))
    : 0

  // Pitch filter/column only appear when the user has narrowed to a single
  // venue AND that venue has >1 pitch. Keeps the default view identical to
  // pre-multi-pitch for the common single-pitch case.
  const selectedVenue = venue_id === "all"
    ? null
    : venueOptions.find((v) => v.id === venue_id) ?? null
  const selectedPitches = selectedVenue?.pitches ?? []
  const showPitchControls = selectedPitches.length > 1

  // Build a fast lookup for pitch names so the column can render a friendly
  // label without re-scanning the pitches array on every row.
  const pitchNameById = new Map<string, string>()
  for (const p of selectedPitches) pitchNameById.set(p.id, p.name)

  const columns: ColumnDef<Booking>[] = [
    {
      accessorKey: "id",
      header: t("booking_id"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-muted-foreground">
            #{row.original.id.slice(0, 8)}
          </span>
          {row.original.recurringGroupId && (
            <span title={t("recurring")} className="text-brand">
              <Repeat className="h-3 w-3" />
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "venue",
      header: t("venue"),
      cell: ({ row }) => (
        <span className="font-medium text-sm">{row.original.venue.name}</span>
      ),
    },
    // Pitch column only appears in multi-pitch context. Legacy bookings with
    // no pitchId resolve on the server to the venue's first-of-sport pitch —
    // the map lookup below therefore always hits when the venue is multi-pitch.
    ...(showPitchControls
      ? ([
          {
            id: "pitch",
            header: t("pitch"),
            cell: ({ row }) => {
              const pid = row.original.pitchId
              const name = pid ? pitchNameById.get(pid) : undefined
              return (
                <span className="text-sm">
                  {name ?? <span className="text-muted-foreground">—</span>}
                </span>
              )
            },
          },
        ] satisfies ColumnDef<Booking>[])
      : []),
    {
      accessorKey: "player",
      header: t("customer_name"),
      cell: ({ row }) => {
        const b = row.original
        // On a manual booking `player` is the OWNER — the name of whoever typed it in.
        // bookingPersonName prefers the customer record, then the legacy "Walk-in: …"
        // fragment, and only then falls back to the player.
        const name = bookingPersonName(b, t("walk_in_customer"))
        const phone = bookingPersonPhone(b)
        return (
          <div className="min-w-0">
            <div className="truncate text-sm">{name}</div>
            {phone && (
              <div className="truncate text-xs text-muted-foreground" dir="ltr">
                {phone}
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: "channel",
      header: t("booking_channel"),
      // Where the booking came from. Until this existed the two were indistinguishable
      // once created — the flag was consumed at creation and thrown away.
      cell: ({ row }) =>
        row.original.isManual ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
            <Store className="h-3 w-3" />
            {t("channel_counter")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand-ink">
            <Smartphone className="h-3 w-3" />
            {t("channel_app")}
          </span>
        ),
    },
    {
      accessorKey: "sport",
      header: t("sport"),
      cell: ({ row }) => <span className="capitalize">{row.original.sport}</span>,
    },
    {
      accessorKey: "pitchSize",
      header: t("pitch_size"),
      // Empty cell for legacy bookings on single-size venues
      cell: ({ row }) => {
        const sz = row.original.pitchSize
        if (!sz) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-xs font-medium">
            {sz}
            {t("a_side")}
          </span>
        )
      },
    },
    {
      accessorKey: "date",
      header: t("date_time"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDateTime(row.original.date)}</span>
      ),
    },
    {
      accessorKey: "duration",
      header: t("duration"),
      // duration is now in minutes (backend migration); format as "1h 30m"
      cell: ({ row }) => {
        const m = row.original.duration
        const h = Math.floor(m / 60)
        const rem = m % 60
        return rem === 0 ? `${h}h` : `${h}h ${rem}m`
      },
    },
    {
      accessorKey: "amount",
      header: t("amount"),
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(row.original.amount)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => {
        const b = row.original
        // The backend cannot invent an "expired" status — "cancelled" is the only literal
        // that frees a slot — so an auto-released hold arrives here indistinguishable from a
        // customer who changed their mind. Saying "Cancelled" would be a small lie told to
        // an owner about his own customer, so the badge reads the timestamp instead.
        if (b.status === "cancelled" && b.autoCancelledAt) {
          return (
            <span
              className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2"
              title={t("status_expired_hint")}
            >
              {t("status_expired")}
            </span>
          )
        }
        return <StatusBadge status={b.status} />
      },
    },
    {
      id: "payment",
      header: t("payment_method"),
      cell: ({ row }) => {
        const b = row.original
        const method = b.paymentMethod === "cliq"
          ? t("payment_cliq")
          : b.paymentMethod ?? "—"
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{method}</span>
            {b.paymentProofStatus && <StatusBadge status={b.paymentProofStatus} />}
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const b = row.original
        const remaining = Math.max(0, (b.totalAmount ?? b.amount) - (b.amountPaid ?? 0))
        return (
          <div className="flex items-center gap-2">
            {b.paymentMethod === "cliq" && b.paymentProofStatus && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewBookingId(b.id)}
              >
                <Eye className="h-3 w-3 me-1" />
                {t("review_proof")}
              </Button>
            )}
            {b.recurringGroupId && b.status !== "cancelled" && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setCancelGroupId(b.recurringGroupId!)}
              >
                <Ban className="h-3 w-3 me-1" />
                {t("cancel_series")}
              </Button>
            )}
            {b.status === "confirmed" && (isAdmin || isOwner) && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  onClick={() => setCompleteBookingId(b.id)}
                >
                  <CheckCircle className="h-3 w-3 me-1" />
                  {/* One tap = he played and he paid. The amount is on the button so the
                      owner knows what he is collecting before he taps it. */}
                  {remaining > 0.001
                    ? `${t("mark_completed")} (${formatCurrency(remaining)})`
                    : t("mark_completed")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={() => setNoShowBookingId(b.id)}
                >
                  <UserX className="h-3 w-3 me-1" />
                  {t("mark_no_show")}
                </Button>
              </>
            )}
            {CANCELLABLE_STATUSES.includes(b.status) && (isAdmin || isOwner) && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setCancelBookingId(b.id)}
              >
                <X className="h-3 w-3 me-1" />
                {t("cancel")}
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_bookings")} subtitle={t("view_filter_bookings")} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={status} onValueChange={handleFilterChange(setStatus)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("all_statuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_statuses")}</SelectItem>
            {BOOKING_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {lang === "ar" ? s.labelAr : s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); resetPage() }}
          className={DATE_INPUT_CLASS}
          title={t("from_date")}
        />
        <span className="text-sm text-muted-foreground">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); resetPage() }}
          className={DATE_INPUT_CLASS}
          title={t("to_date")}
        />

        <Select
          value={venue_id}
          onValueChange={(v) => {
            // Changing venue invalidates the pitch filter (pitches are
            // venue-scoped), so reset it in lockstep.
            setVenueId(v)
            setPitchId("all")
            resetPage()
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("all_venues")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_venues")}</SelectItem>
            {venueOptions.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showPitchControls && (
          <Select value={pitch_id} onValueChange={handleFilterChange(setPitchId)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("pick_pitch")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("pitches")}</SelectItem>
              {selectedPitches.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(status !== "all" || from || to || venue_id !== "all" || pitch_id !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              setStatus("all")
              setFrom("")
              setTo("")
              setVenueId("all")
              setPitchId("all")
              resetPage()
            }}
          >
            <X className="h-3 w-3 me-1" />
            {t("clear_filters")}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={bookings}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t("no_bookings")}
        emptyIcon={CalendarCheck}
        emptyAction={
          (status !== "all" || from || to || venue_id !== "all" || pitch_id !== "all") ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStatus("all")
                setFrom("")
                setTo("")
                setVenueId("all")
                setPitchId("all")
                resetPage()
              }}
            >
              <X className="h-3 w-3 me-1" />
              {t("clear_filters")}
            </Button>
          ) : undefined
        }
      />

      <ProofReviewDialog
        bookingId={reviewBookingId}
        open={!!reviewBookingId}
        onClose={() => setReviewBookingId(null)}
      />

      <ConfirmDialog
        title={t("cancel_series")}
        description={t("cancel_series_confirm")}
        open={!!cancelGroupId}
        onOpenChange={(open) => { if (!open) setCancelGroupId(null) }}
        onConfirm={() => cancelGroupId && cancelSeriesMutation.mutate(cancelGroupId)}
        isLoading={cancelSeriesMutation.isPending}
      />

      <ConfirmDialog
        title={t("mark_completed")}
        description={
          completeRemaining > 0.001
            ? t("mark_completed_and_collect_confirm").replace("{amount}", formatCurrency(completeRemaining))
            : t("mark_completed_confirm")
        }
        open={!!completeBookingId}
        onOpenChange={(open) => { if (!open) setCompleteBookingId(null) }}
        onConfirm={() => completeBookingId && completeMutation.mutate(completeBookingId)}
        isLoading={completeMutation.isPending}
      />

      <ConfirmDialog
        title={t("mark_no_show")}
        description={t("mark_no_show_confirm")}
        open={!!noShowBookingId}
        onOpenChange={(open) => { if (!open) setNoShowBookingId(null) }}
        onConfirm={() => noShowBookingId && noShowMutation.mutate(noShowBookingId)}
        isLoading={noShowMutation.isPending}
      />

      <ConfirmDialog
        title={t("cancel")}
        description={t("cancel_booking_confirm")}
        variant="destructive"
        open={!!cancelBookingId}
        onOpenChange={(open) => { if (!open) setCancelBookingId(null) }}
        onConfirm={() => cancelBookingId && cancelMutation.mutate(cancelBookingId)}
        isLoading={cancelMutation.isPending}
      />

    </div>
  )
}
