import { type ColumnDef } from "@tanstack/react-table"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DataTable } from "@/components/shared/DataTable"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency, formatDateTime } from "@/lib/formatters"
import type { Payment } from "@/api/payments"

// ---------------------------------------------------------------------------
// Payments tab — payments DataTable
// ---------------------------------------------------------------------------

export function PaymentsTab({
  payments,
  isLoading,
  pagination,
  onPageChange,
}: {
  payments: Payment[]
  isLoading: boolean
  pagination: { page: number; limit: number; total: number }
  onPageChange: (p: number) => void
}) {
  const { t } = useT()
  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "date",
      header: t("date_time"),
      cell: ({ row }) => (
        <span className="text-sm text-[hsl(var(--ink-2))]">
          {formatDateTime(row.original.date)}
        </span>
      ),
    },
    {
      accessorKey: "bookingRef",
      header: t("profile_booking_col"),
      cell: ({ row }) => (
        <span className="mono text-[11px] text-[hsl(var(--ink-3))]">
          {row.original.bookingRef}
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
      header: t("payment_method"),
      cell: ({ row }) => (
        <span className="mono text-[11px] uppercase text-[hsl(var(--ink-2))]">
          {row.original.method}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
  return (
    <DataTable
      columns={columns}
      data={payments}
      pagination={pagination}
      onPageChange={onPageChange}
      isLoading={isLoading}
      emptyMessage={t("profile_no_payments")}
    />
  )
}
