import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { CalendarCheck, X, Eye, Repeat, Ban } from "lucide-react"
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
import { getBookings, cancelSeries, type Booking } from "@/api/bookings"
import { getVenues } from "@/api/venues"
import { usePagination } from "@/hooks/usePagination"
import { useOwnerFilter } from "@/hooks/useRole"
import { BOOKING_STATUSES } from "@/lib/constants"
import { formatCurrency, formatDateTime } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"

const DATE_INPUT_CLASS =
  "flex h-9 w-36 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"

export default function BookingsPage() {
  const { page, limit, setPage, resetPage } = usePagination()
  const ownerFilter = useOwnerFilter()
  const { t, lang } = useT()

  const [status,   setStatus]   = useState("all")
  const [from,     setFrom]     = useState("")
  const [to,       setTo]       = useState("")
  const [venue_id, setVenueId]  = useState("all")
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null)
  const [cancelGroupId, setCancelGroupId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const cancelSeriesMutation = useMutation({
    mutationFn: (groupId: string) => cancelSeries(groupId),
    onSuccess: () => {
      toast.success(t("series_cancelled"))
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      setCancelGroupId(null)
    },
    onError: () => toast.error(t("series_cancel_failed")),
  })

  const handleFilterChange = useCallback(
    (setter: (v: string) => void) => (v: string) => { setter(v); resetPage() },
    [resetPage]
  )

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", { page, limit, status, from, to, venue_id, ...ownerFilter }],
    queryFn: () => getBookings({
      page, limit,
      status:   status   === "all" ? undefined : status,
      from:     from     || undefined,
      to:       to       || undefined,
      venue_id: venue_id === "all" ? undefined : venue_id,
      ...ownerFilter,
    }),
  })

  const { data: venuesData } = useQuery({
    queryKey: ["venues-for-bookings", ownerFilter],
    queryFn: () => getVenues({ limit: 100, ...ownerFilter }),
  })

  const bookings: Booking[] = data?.data ?? []
  const pagination          = data?.pagination ?? { page, limit, total: 0 }
  const venueOptions        = venuesData?.data ?? []

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
    {
      accessorKey: "player",
      header: t("player"),
      cell: ({ row }) => row.original.player.name,
    },
    {
      accessorKey: "sport",
      header: t("sport"),
      cell: ({ row }) => <span className="capitalize">{row.original.sport}</span>,
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
      cell: ({ row }) => `${row.original.duration}h`,
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
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
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

        <Select value={venue_id} onValueChange={handleFilterChange(setVenueId)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("all_venues")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_venues")}</SelectItem>
            {venueOptions.map((v: { id: string; name: string }) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(status !== "all" || from || to || venue_id !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => { setStatus("all"); setFrom(""); setTo(""); setVenueId("all"); resetPage() }}
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
          (status !== "all" || from || to || venue_id !== "all") ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setStatus("all"); setFrom(""); setTo(""); setVenueId("all"); resetPage() }}
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
    </div>
  )
}
