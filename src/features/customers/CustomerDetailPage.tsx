import { useEffect, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ChevronRight,
  Loader2,
  Phone,
  MessageCircle,
  Archive,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react"
import {
  getCustomer,
  getCustomerBookings,
  updateCustomer,
  archiveCustomer,
  whatsappLink,
  type CustomerBookingItem,
} from "@/api/customers"
import { StatCard } from "@/components/shared/StatCard"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePagination } from "@/hooks/usePagination"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatDate, formatCurrency } from "@/lib/formatters"

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useT()
  const navigate = useNavigate()
  const qc = useQueryClient()
  // A read-only clerk may look a customer up but not rewrite the book. The server enforces
  // this too; hiding the controls just stops the request being made at all.
  const { canWrite } = useRole()
  const { page, limit, setPage } = usePagination()
  const [name, setName] = useState("")
  const [note, setNote] = useState("")
  const [confirmArchive, setConfirmArchive] = useState(false)

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (customer) {
      setName(customer.name)
      setNote(customer.note ?? "")
    }
  }, [customer])

  const { data: bookingsPage, isLoading: bookingsLoading } = useQuery({
    queryKey: ["customer-bookings", id, page, limit],
    queryFn: () => getCustomerBookings(id!, { page, limit }),
    enabled: !!id,
  })

  const save = useMutation({
    mutationFn: () => updateCustomer(id!, { name: name.trim(), note: note.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] })
      qc.invalidateQueries({ queryKey: ["customer", id] })
      toast.success(t("customer_saved"))
    },
    onError: () => toast.error(t("something_went_wrong")),
  })

  const archive = useMutation({
    mutationFn: () => archiveCustomer(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] })
      toast.success(t("customer_archived"))
      navigate("/customers")
    },
    onError: () => toast.error(t("something_went_wrong")),
  })

  const dirty = !!customer && (name.trim() !== customer.name || note.trim() !== (customer.note ?? ""))
  const s = customer?.stats

  const columns: ColumnDef<CustomerBookingItem>[] = [
    {
      id: "date",
      header: t("date_time"),
      cell: ({ row }) => (
        <div>
          <div className="text-sm font-medium">{formatDate(row.original.date)}</div>
          {row.original.startTime && (
            <div className="text-xs text-muted-foreground">{row.original.startTime}</div>
          )}
        </div>
      ),
    },
    {
      id: "venue",
      header: t("venue"),
      cell: ({ row }) => <span className="text-sm">{row.original.venueName}</span>,
    },
    {
      id: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "amount",
      header: t("amount"),
      cell: ({ row }) => {
        const b = row.original
        const owed = b.status !== "cancelled" && b.amountPaid + 0.001 < b.totalAmount
        return (
          <div className="text-sm">
            <span className={owed ? "font-semibold text-amber-ink" : ""}>
              {formatCurrency(b.amountPaid)}
            </span>
            <span className="text-muted-foreground"> / {formatCurrency(b.totalAmount)}</span>
          </div>
        )
      },
    },
    {
      id: "notes",
      header: t("notes"),
      cell: ({ row }) => (
        <span className="block max-w-[28ch] truncate text-sm text-muted-foreground">
          {row.original.notes || "—"}
        </span>
      ),
    },
  ]

  if (isLoading || !customer || !s) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link to="/customers" className="hover:text-foreground">
          {t("nav_customers")}
        </Link>
        <ChevronRight className="h-3 w-3 rtl:rotate-180" />
        <span className="max-w-[40ch] truncate font-medium text-foreground">
          {customer.name || t("walk_in_customer")}
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{customer.name || t("walk_in_customer")}</h1>
          <div className="mt-0.5 text-sm text-muted-foreground" dir="ltr">
            {customer.phone}
          </div>
        </div>

        <div className="flex gap-2">
          {/* Both leave from the OWNER'S own phone and his own relationship. The platform
              never contacts his customers — that is the promise that makes him willing to
              type their numbers in at all. */}
          <Button asChild size="sm" className="gap-1.5">
            <a href={whatsappLink(customer.phone, "")} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-3.5 w-3.5" />
              {t("customer_whatsapp")}
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={`tel:${customer.phone}`}>
              <Phone className="h-3.5 w-3.5" />
              {t("customer_call")}
            </a>
          </Button>
          {canWrite && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-destructive"
              onClick={() => setConfirmArchive(true)}
            >
              <Archive className="h-3.5 w-3.5" />
              {t("customer_archive")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title={t("total_bookings")} value={s.totalBookings} icon={CalendarClock} color="blue" />
        <StatCard title={t("stat_completed")} value={s.completed} icon={CheckCircle2} color="green" />
        <StatCard
          title={t("stat_no_shows")}
          value={s.noShow}
          icon={AlertTriangle}
          color={s.isUnreliable ? "red" : "amber"}
        />
        <StatCard title={t("stat_cancelled")} value={s.cancelled} icon={XCircle} color="red" />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t("stat_upcoming")}
          </div>
          <div className="mt-0.5 text-sm font-semibold">{s.upcoming}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t("stat_owed")}
          </div>
          <div className={"mt-0.5 text-sm font-semibold " + (s.amountOwed > 0 ? "text-amber-ink" : "")}>
            {s.amountOwed > 0 ? formatCurrency(s.amountOwed) : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t("stat_last_visit")}
          </div>
          <div className="mt-0.5 text-sm font-semibold">
            {s.lastVisit ? formatDate(s.lastVisit) : t("customer_never_visited")}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t("stat_customer_since")}
          </div>
          <div className="mt-0.5 text-sm font-semibold">
            {s.customerSince ? formatDate(s.customerSince) : "—"}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("customer_name")}
            </span>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canWrite} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("customer_note_label")}
            </span>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("customer_note_placeholder")}
              disabled={!canWrite}
            />
          </label>
        </div>
        {canWrite && (
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
            {t("save")}
          </Button>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {t("customer_all_bookings")}
        </h2>
        <DataTable
          columns={columns}
          data={bookingsPage?.data ?? []}
          isLoading={bookingsLoading}
          pagination={{ page, limit, total: bookingsPage?.pagination?.total ?? 0 }}
          onPageChange={setPage}
          emptyMessage={t("customers_empty")}
        />
      </div>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("customer_archive")}
        description={t("customer_archive_confirm").replace("{name}", customer.name ?? "")}
        confirmLabel={t("customer_archive")}
        variant="destructive"
        isLoading={archive.isPending}
        onConfirm={() => archive.mutate()}
      />
    </div>
  )
}
