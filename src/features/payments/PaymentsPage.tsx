import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { CreditCard, X } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getPayments, type Payment } from "@/api/payments"
import { usePagination } from "@/hooks/usePagination"
import { PAYMENT_STATUSES } from "@/lib/constants"
import { formatCurrency, formatDateTime } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

export default function PaymentsPage() {
  const { page, limit, setPage, resetPage } = usePagination()
  const [status, setStatus] = useState("all")
  const { t, lang } = useT()

  const handleStatusChange = useCallback(
    (v: string) => { setStatus(v); resetPage() },
    [resetPage]
  )

  const { data, isLoading } = useQuery({
    queryKey: ["payments", { page, limit, status: status === "all" ? "" : status }],
    queryFn: () => getPayments({
      page, limit,
      status: status === "all" ? undefined : status,
    }),
  })

  const payments: Payment[] = data?.data ?? []
  const pagination          = data?.pagination ?? { page, limit, total: 0 }

  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "id",
      header: t("transaction_id"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          #{row.original.id}
        </span>
      ),
    },
    {
      accessorKey: "bookingRef",
      header: t("booking_ref"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          #{row.original.bookingRef}
        </span>
      ),
    },
    {
      accessorKey: "player",
      header: t("player"),
      cell: ({ row }) => row.original.player.name,
    },
    {
      accessorKey: "amount",
      header: t("amount"),
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(row.original.amount)}</span>
      ),
    },
    {
      accessorKey: "method",
      header: t("method"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.method}</span>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "date",
      header: t("date_time"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDateTime(row.original.date)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("payments")} subtitle={t("platform_payments")} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("all_statuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_statuses")}</SelectItem>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {lang === "ar" ? s.labelAr : s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {status !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => { setStatus("all"); resetPage() }}
          >
            <X className="h-3 w-3 me-1" />
            {t("clear_filters")}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={payments}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t("no_payments")}
        emptyIcon={CreditCard}
      />
    </div>
  )
}
